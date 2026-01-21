import { chromium } from 'playwright'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { writeFileSync } from 'fs'
import { createEvent } from 'ics'
import { huggingFaceAPI } from './lib/huggingface.js'
import { config } from './staticFiles.js'
import { notify } from './lib/ntfy.js'

dayjs.extend(customParseFormat)

// Pre-calculate target date (6 days ahead) before execution
const TARGET_DATE = config.date ? dayjs(config.date, 'D/MM/YYYY') : dayjs().add(6, 'days')
const DATE_ISO = TARGET_DATE.format('DD/MM/YYYY')
const DATE_DEB_FORMAT = TARGET_DATE.format('YYYY/MM/DD')

export const bookTennis = async (retryCount = 0) => {
  const DRY_RUN_MODE = process.argv.includes('--dry-run')
  const MAX_RETRIES = 3
  
  if (DRY_RUN_MODE) {
    console.log('----- DRY RUN START -----')
    console.log('Script lancé en mode DRY RUN. Afin de tester votre configuration, une recherche va être lancé mais AUCUNE réservation ne sera réalisée')
  }

  if (retryCount > 0) {
    console.log(`${dayjs().format()} - Retry attempt ${retryCount}/${MAX_RETRIES}`)
    await new Promise(resolve => setTimeout(resolve, 2000)) // Reduced retry delay
  }

  const startTime = Date.now()
  console.log(`${dayjs().format()} - Starting booking for ${DATE_ISO}`)

  // Optimized browser launch - removed --disable-javascript (breaks AJAX slot loading)
  const browser = await chromium.launch({ 
    headless: true, 
    slowMo: 0,
    args: ['--disable-images', '--disable-dev-shm-usage', '--no-sandbox']
  })

  const page = await browser.newPage()
  page.setDefaultTimeout(15000) // Aggressive timeout for faster failure

  try {
    // Login - optimized
    await page.goto('https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=tennis&view=start&full=1', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    })
    await page.click('#button_suivi_inscription', { timeout: 5000 })
  await page.fill('#username', config.account.email)
  await page.fill('#password', config.account.password)
  await page.click('#form-login >> button')
    await page.waitForSelector('.main-informations', { timeout: 10000 })
    console.log(`${dayjs().format()} - Logged in (${Date.now() - startTime}ms)`)

    const locations = !Array.isArray(config.locations) ? Object.keys(config.locations) : config.locations
    
    locationsLoop:
    for (const location of locations) {
      const locationStartTime = Date.now()
      console.log(`${dayjs().format()} - Trying ${location}`)

      // Navigate to search page
      await page.goto('https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=recherche&view=recherche_creneau#!', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      })

      // Location selection - optimized
      const locationInput = page.locator('.tokens-input-text')
      await locationInput.fill(`${location} `)
      
      try {
        await page.waitForSelector('.tokens-suggestions-list-element', { timeout: 3000 })
        const suggestions = await page.$$('.tokens-suggestions-list-element')
        
        let clicked = false
        for (const sug of suggestions) {
          const text = await sug.textContent().catch(() => '') || ''
          if (text.trim().includes(location) || location.includes(text.trim())) {
            await sug.click()
            clicked = true
            break
          }
        }
        
        if (!clicked && suggestions.length > 0) {
          await suggestions[0].click()
        }
      } catch (e) {
        await locationInput.press('Enter')
      }

      // Date selection - pre-calculated
      await page.click('#when', { timeout: 5000 })
      const dateSelector = `[dateiso="${DATE_ISO}"]`
      
      try {
        await page.waitForSelector(dateSelector, { timeout: 8000 })
        await page.click(dateSelector)
        await page.waitForSelector('.date-picker', { state: 'hidden', timeout: 3000 })
      } catch (e) {
        // Try alternative format
        const altDateSelector = `[dateiso="${TARGET_DATE.format('D/M/YYYY')}"]`
        await page.waitForSelector(altDateSelector, { timeout: 5000 })
        await page.click(altDateSelector)
        await page.waitForSelector('.date-picker', { state: 'hidden', timeout: 3000 })
      }

      // Search
      await page.click('#rechercher', { timeout: 5000 })
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
        // Fallback to domcontentloaded if networkidle times out
        return page.waitForLoadState('domcontentloaded', { timeout: 5000 })
      })

      // Fast slot detection - direct selector queries only
      let selectedHour = null
      const courtNumbers = !Array.isArray(config.locations) ? config.locations[location] : []
      
      hoursLoop:
      for (const hour of config.hours) {
        const dateDeb = `[datedeb="${DATE_DEB_FORMAT} ${hour}:00:00"]`
        const slotElement = await page.$(dateDeb).catch(() => null)
        
        if (!slotElement) continue

        // Expand panel if hidden
        if (await page.isHidden(dateDeb).catch(() => true)) {
          await page.click(`#head${location.replaceAll(' ', '')}${hour}h .panel-title`).catch(() => {})
          await new Promise(resolve => setTimeout(resolve, 300)) // Minimal wait for panel expansion
        }

        const slots = await page.$$(dateDeb).catch(() => [])
        
        for (const slot of slots) {
          const courtId = await slot.getAttribute('courtid').catch(() => null)
          if (!courtId) continue

          const bookSlotButton = `[courtid="${courtId}"]${dateDeb}`
          
          // Court number filter
          if (courtNumbers.length > 0) {
            try {
              const courtElement = await page.$(`.court:left-of(${bookSlotButton})`)
              if (courtElement) {
                const courtText = await courtElement.innerText()
                const courtMatch = courtText.match(/Court N°(\d+)/)
                if (courtMatch && !courtNumbers.includes(parseInt(courtMatch[1]))) {
                  continue
                }
              }
            } catch (e) {
              // Continue if court check fails
            }
          }

          // Price and court type filter
          try {
            const priceElement = await page.$(`.price-description:left-of(${bookSlotButton})`)
            if (priceElement) {
              const priceHtml = await priceElement.innerHTML()
              const [priceType, courtType] = priceHtml.split('<br>')
              if (!config.priceType.includes(priceType) || !config.courtType.includes(courtType)) {
                continue
              }
            }
          } catch (e) {
            // Continue if price check fails
          }

          // Found valid slot - click it
          selectedHour = hour
          await page.click(bookSlotButton, { timeout: 5000 })
          console.log(`${dayjs().format()} - ✅ Slot found: ${location} at ${hour}:00 (${Date.now() - locationStartTime}ms)`)
          break hoursLoop
        }
      }

      // Verify we're on reservation page
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 })
      const finalPageTitle = await page.title()
      
      if (finalPageTitle !== 'Paris | TENNIS - Reservation') {
        console.log(`${dayjs().format()} - No slot found at ${location}, trying next...`)
        continue
      }

      console.log(`${dayjs().format()} - ✅ On reservation page for ${location}`)

      // CAPTCHA handling - optimized
      if (await page.$('.captcha').catch(() => null)) {
        console.log(`${dayjs().format()} - Solving CAPTCHA`)
        let i = 0
        let captchaSolved = false
        
        while (!captchaSolved && i < 5) {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          
          try {
            const captchaIframe = page.frameLocator('#li-antibot-iframe')
            const captchaImg = await captchaIframe.locator('#li-antibot-questions-container img').screenshot({ path: 'img/captcha.png' })
            const resCaptcha = await huggingFaceAPI(new Blob([captchaImg]))
            await captchaIframe.locator('#li-antibot-answer').fill(resCaptcha)
          await captchaIframe.locator('#li-antibot-validate').click()

            // Check if solved
            await new Promise(resolve => setTimeout(resolve, 1000))
            const noteText = await captchaIframe.locator('#li-antibot-check-note').textContent().catch(() => '')
            if (noteText === 'Vérifié avec succès') {
              captchaSolved = true
              console.log(`${dayjs().format()} - CAPTCHA solved`)
            } else {
              i++
            }
          } catch (e) {
            i++
            if (i >= 5) throw new Error('CAPTCHA failed after 5 attempts')
          }
        }
      }

      // Player input
      for (const [i, player] of config.players.entries()) {
        if (i > 0 && i < config.players.length) {
          await page.click('.addPlayer', { timeout: 3000 })
        }
        await page.waitForSelector(`[name="player${i + 1}"]`, { timeout: 5000 })
        await page.fill(`[name="player${i + 1}"] >> nth=0`, player.lastName)
        await page.fill(`[name="player${i + 1}"] >> nth=1`, player.firstName)
      }

      await page.keyboard.press('Enter')

      // Payment
      await page.waitForSelector('#order_select_payment_form #paymentMode', { state: 'attached', timeout: 5000 })
      const paymentMode = await page.$('#order_select_payment_form #paymentMode')
      await paymentMode.evaluate(el => {
        el.removeAttribute('readonly')
        el.style.display = 'block'
      })
      await paymentMode.fill('existingTicket')

      if (DRY_RUN_MODE) {
        console.log(`${dayjs().format()} - DRY RUN: Would book ${location} on ${DATE_ISO} at ${selectedHour}h`)
        console.log(`Total time: ${Date.now() - startTime}ms`)
        console.log('----- DRY RUN END -----')
        await page.click('#previous')
        await page.click('#btnCancelBooking')
        break locationsLoop
      }

      // Submit booking
      const submit = await page.$('#order_select_payment_form #envoyer')
      await submit.evaluate(el => el.classList.remove('hide'))
      await submit.click()

      await page.waitForSelector('.confirmReservation', { timeout: 10000 })

      // Extract reservation details
      const address = (await (await page.$('.address')).textContent()).trim().replace(/( ){2,}/g, ' ')
      const dateStr = (await (await page.$('.date')).textContent()).trim().replace(/( ){2,}/g, ' ')
      const court = (await (await page.$('.court')).textContent()).trim().replace(/( ){2,}/g, ' ')

      console.log(`${dayjs().format()} - ✅ BOOKING SUCCESS: ${address}`)
      console.log(`Date: ${dateStr}, Court: ${court}`)
      console.log(`Total execution time: ${Date.now() - startTime}ms`)

      // Create ICS event
      const [day, month, year] = [TARGET_DATE.date(), TARGET_DATE.month() + 1, TARGET_DATE.year()]
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
          await notify(Buffer.from(value, 'utf8'), `Confirmation pour le ${DATE_ISO}`, config.ntfy)
        }
      })
      break
    }
  } catch (e) {
    console.log(`${dayjs().format()} - Error: ${e.message}`)
    console.log(`Execution time before error: ${Date.now() - startTime}ms`)
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const errorMsg = e.message.toLowerCase()
      const isRetryableError = 
        errorMsg.includes('captcha') ||
        errorMsg.includes('timeout') ||
        errorMsg.includes('network') ||
        errorMsg.includes('navigation')
      
      if (isRetryableError) {
        console.log(`${dayjs().format()} - Retrying... (${retryCount + 1}/${MAX_RETRIES})`)
        await browser.close()
        return bookTennis(retryCount + 1)
      }
    }
    
    console.log(`${dayjs().format()} - Booking failed after ${retryCount + 1} attempts`)
    await page.screenshot({ path: `img/failure-${Date.now()}.png` }).catch(() => {})
  }

  await browser.close()
}

// Main execution (only if run directly, not when imported)
const isMainModule = process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('/index.js'))
if (isMainModule) {
  const runBooking = async () => {
    try {
      await bookTennis(0)
    } catch (e) {
      console.log(`${dayjs().format()} - Fatal error: ${e.message}`)
      process.exit(1)
    }
  }
  runBooking()
}
