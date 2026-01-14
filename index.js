import { chromium } from 'playwright'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { writeFileSync } from 'fs'
import { createEvent } from 'ics'
import { huggingFaceAPI } from './lib/huggingface.js'
import { config } from './staticFiles.js'
import { notify } from './lib/ntfy.js'

dayjs.extend(customParseFormat)

const bookTennis = async (retryCount = 0) => {
  const DRY_RUN_MODE = process.argv.includes('--dry-run')
  const MAX_RETRIES = 3
  
  if (DRY_RUN_MODE) {
    console.log('----- DRY RUN START -----')
    console.log('Script lancé en mode DRY RUN. Afin de tester votre configuration, une recherche va être lancé mais AUCUNE réservation ne sera réalisée')
  }

  if (retryCount > 0) {
    console.log(`${dayjs().format()} - Retry attempt ${retryCount}/${MAX_RETRIES}`)
    await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds before retry
  }

  console.log(`${dayjs().format()} - Starting searching tennis`)
  // Optimize for speed - disable images, reduce timeouts
  const browser = await chromium.launch({ 
    headless: true, 
    slowMo: 0, 
    timeout: 60000,
    args: ['--disable-images', '--disable-javascript'] // Speed optimization
  })

  console.log(`${dayjs().format()} - Browser started`)
  const page = await browser.newPage()
  page.setDefaultTimeout(60000) // Reduced timeout for faster failure
  await page.goto('https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=tennis&view=start&full=1')

  await page.click('#button_suivi_inscription')
  await page.fill('#username', config.account.email)
  await page.fill('#password', config.account.password)
  await page.click('#form-login >> button')

  console.log(`${dayjs().format()} - User connected`)

  // wait for login redirection - faster timeout
  await page.waitForSelector('.main-informations', { timeout: 30000 })

  try {
    const locations = !Array.isArray(config.locations) ? Object.keys(config.locations) : config.locations
    locationsLoop:
    for (const location of locations) {
      console.log(`${dayjs().format()} - Search at ${location}`)
      // Faster navigation
      await page.goto('https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=recherche&view=recherche_creneau#!', { waitUntil: 'domcontentloaded' })

      // select tennis location - use fill instead of pressSequentially for speed
      await page.locator('.tokens-input-text').fill(`${location} `)
      await page.waitForSelector(`.tokens-suggestions-list-element >> text="${location}"`, { timeout: 10000 })
      await page.click(`.tokens-suggestions-list-element >> text="${location}"`)

      // select date - pre-calculate
      await page.click('#when')
      const date = config.date ? dayjs(config.date, 'D/MM/YYYY') : dayjs().add(6, 'days')
      const dateSelector = `[dateiso="${date.format('DD/MM/YYYY')}"]`
      await page.waitForSelector(dateSelector, { timeout: 10000 })
      await page.click(dateSelector)
      await page.waitForSelector('.date-picker', { state: 'hidden', timeout: 5000 })

      await page.click('#rechercher')

      // Faster load check
      await page.waitForLoadState('domcontentloaded', { timeout: 30000 })

      let selectedHour
      hoursLoop:
      for (const hour of config.hours) {
        const dateDeb = `[datedeb="${date.format('YYYY/MM/DD')} ${hour}:00:00"]`
        if (await page.$(dateDeb)) {
          if (await page.isHidden(dateDeb)) {
            await page.click(`#head${location.replaceAll(' ', '')}${hour}h .panel-title`)
          }

          const courtNumbers = !Array.isArray(config.locations) ? config.locations[location] : []
          const slots = await page.$$(dateDeb)
          for (const slot of slots) {
            const bookSlotButton = `[courtid="${await slot.getAttribute('courtid')}"]${dateDeb}`
            if (courtNumbers.length > 0) {
              const courtName = (await (await page.$(`.court:left-of(${bookSlotButton})`)).innerText()).trim()
              if (!courtNumbers.includes(parseInt(courtName.match(/Court N°(\d+)/)[1]))) {
                continue
              }
            }

            const [priceType, courtType] = (await (await page.$(`.price-description:left-of(${bookSlotButton})`)).innerHTML()).split('<br>')
            if (!config.priceType.includes(priceType) || !config.courtType.includes(courtType)) {
              continue
            }
            selectedHour = hour
            await page.click(bookSlotButton)

            break hoursLoop
          }
        }
      }

      if (await page.title() !== 'Paris | TENNIS - Reservation') {
        console.log(`${dayjs().format()} - Failed to find reservation for ${location}`)
        continue
      }

      await page.waitForLoadState('domcontentloaded')

      if (await page.$('.captcha')) {
        console.log(`${dayjs().format()} - CAPTCHA detected, attempting to solve`)
        let i = 0
        let note
        do {
          if (i > 4) {
            // Increased retries for CAPTCHA
            console.log(`${dayjs().format()} - CAPTCHA failed after ${i} attempts, will retry entire booking`)
            throw new Error('Can\'t resolve captcha after multiple attempts')
          }

          if (i > 0) {
            console.log(`${dayjs().format()} - Waiting for new CAPTCHA (attempt ${i + 1})`)
            const iframeDetached = new Promise((resolve) => {
              page.on('framedetached', () => resolve('New captcha'))
            })
            await iframeDetached
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
          
          // Original simpler approach - just wait for iframe and solve
          const captchaIframe = page.frameLocator('#li-antibot-iframe')
          const captcha = await captchaIframe.locator('#li-antibot-questions-container img').screenshot({ path: 'img/captcha.png' })
          const resCaptcha = await huggingFaceAPI(new Blob([captcha]))
          await captchaIframe.locator('#li-antibot-answer').pressSequentially(resCaptcha)
          await new Promise(resolve => setTimeout(resolve, 500))
          await captchaIframe.locator('#li-antibot-validate').click()

          note = captchaIframe.locator('#li-antibot-check-note')
          i++
        } while (noteText !== 'Vérifié avec succès')
        console.log(`${dayjs().format()} - CAPTCHA solved successfully`)
      }


      for (const [i, player] of config.players.entries()) {
        if (i > 0 && i < config.players.length) {
          await page.click('.addPlayer')
        }
        await page.waitForSelector(`[name="player${i + 1}"]`)
        await page.fill(`[name="player${i + 1}"] >> nth=0`, player.lastName)
        await page.fill(`[name="player${i + 1}"] >> nth=1`, player.firstName)
      }

      await page.keyboard.press('Enter')

      await page.waitForSelector('#order_select_payment_form #paymentMode', { state: 'attached' })
      const paymentMode = await page.$('#order_select_payment_form #paymentMode')
      await paymentMode.evaluate(el => {
        el.removeAttribute('readonly')
        el.style.display = 'block'
      })
      await paymentMode.fill('existingTicket')

      if (DRY_RUN_MODE) {
        console.log(`${dayjs().format()} - Fausse réservation faite : ${location}`)
        console.log(`pour le ${date.format('YYYY/MM/DD')} à ${selectedHour}h`)
        console.log('----- DRY RUN END -----')
        console.log('Pour réellement réserver un crénau, relancez le script sans le paramètre --dry-run')

        await page.click('#previous')
        await page.click('#btnCancelBooking')

        break locationsLoop
      }

      const submit = await page.$('#order_select_payment_form #envoyer')
      submit.evaluate(el => el.classList.remove('hide'))
      await submit.click()

      await page.waitForSelector('.confirmReservation')

      // Extract reservation details
      const address = (await (await page.$('.address')).textContent()).trim().replace(/( ){2,}/g, ' ')
      const dateStr = (await (await page.$('.date')).textContent()).trim().replace(/( ){2,}/g, ' ')
      const court = (await (await page.$('.court')).textContent()).trim().replace(/( ){2,}/g, ' ')

      console.log(`${dayjs().format()} - Réservation faite : ${address}`)
      console.log(`pour le ${dateStr}`)
      console.log(`sur le ${court}`)

      const [day, month, year] = [date.date(), date.month() + 1, date.year()]
      const hourMatch = dateStr.match(/(\d{2})h/)
      const hour = hourMatch ? Number(hourMatch[1]) : 12
      const start = [year, month, day, hour, 0]
      const duration = { hours: 1, minutes: 0 }
      const event = {
        start,
        duration,
        title: 'Réservation Tennis',
        description: `Court: ${court}\nAdresse: ${address}`,
        location: address,
        status: 'CONFIRMED',
      }
      createEvent(event, async (error, value) => {
        if (error) {
          console.log('ICS creation error:', error)
          return
        }

        writeFileSync('event.ics', value)
        if (config.ntfy?.enable === true) {
          await notify(Buffer.from(value, 'utf8'), `Confirmation pour le ${date.format('DD/MM/YYYY')}`, config.ntfy)
        }
      })
      break
    }
  } catch (e) {
    console.log(`${dayjs().format()} - Error occurred: ${e.message}`)
    await page.screenshot({ path: `img/failure-${Date.now()}.png` }).catch(() => {})
    
    // Retry logic for recoverable errors
    if (retryCount < MAX_RETRIES) {
      const errorMsg = e.message.toLowerCase()
      const isRetryableError = 
        errorMsg.includes('captcha') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('network') ||
        errorMsg.includes('navigation') ||
        errorMsg.includes('image not found')
      
      if (isRetryableError) {
        console.log(`${dayjs().format()} - Retryable error detected, attempting retry ${retryCount + 1}/${MAX_RETRIES}`)
        await browser.close()
        return bookTennis(retryCount + 1)
      }
    }
    
    console.log(`${dayjs().format()} - Booking failed after ${retryCount + 1} attempts: ${e.message}`)
  }

  await browser.close()
}

// Main execution with retry wrapper
const runBooking = async () => {
  try {
    await bookTennis(0)
  } catch (e) {
    console.log(`${dayjs().format()} - Final error: ${e.message}`)
    process.exit(1)
  }
}

runBooking()
