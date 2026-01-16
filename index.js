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

      // select tennis location - faster method with timeout
      const locationInput = page.locator('.tokens-input-text')
      await locationInput.fill(`${location} `)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      try {
        // Wait for suggestions with shorter timeout
        await page.waitForSelector('.tokens-suggestions-list-element', { timeout: 5000 })
        const suggestions = await page.$$('.tokens-suggestions-list-element')
        
        // Try exact match first
        let clicked = false
        for (const sug of suggestions) {
          const text = await sug.textContent().catch(() => '') || ''
          if (text.trim().includes(location) || location.includes(text.trim())) {
            await sug.click()
            clicked = true
            break
          }
        }
        
        // If no exact match, click first suggestion
        if (!clicked && suggestions.length > 0) {
          await suggestions[0].click()
        }
      } catch (e) {
        // If suggestions don't appear, try pressing Enter
        await locationInput.press('Enter')
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))

      // select date - pre-calculate
      await page.click('#when')
      const date = config.date ? dayjs(config.date, 'D/MM/YYYY') : dayjs().add(6, 'days')
      console.log(`${dayjs().format()} - Selecting date: ${date.format('DD/MM/YYYY')} (${date.format('dddd')})`)
      const dateSelector = `[dateiso="${date.format('DD/MM/YYYY')}"]`
      try {
        await page.waitForSelector(dateSelector, { timeout: 15000 })
        await page.click(dateSelector)
        await page.waitForSelector('.date-picker', { state: 'hidden', timeout: 5000 })
        console.log(`${dayjs().format()} - Date selected successfully`)
      } catch (e) {
        console.log(`${dayjs().format()} - Date selection failed: ${e.message}, trying alternative format`)
        // Try alternative date format
        const altDateSelector = `[dateiso="${date.format('D/M/YYYY')}"]`
        try {
          await page.waitForSelector(altDateSelector, { timeout: 10000 })
          await page.click(altDateSelector)
          await page.waitForSelector('.date-picker', { state: 'hidden', timeout: 5000 })
        } catch (e2) {
          throw new Error(`Could not select date ${date.format('DD/MM/YYYY')}: ${e2.message}`)
        }
      }

      await page.click('#rechercher')

      // wait until the results page is fully loaded before continue - original method
      await page.waitForLoadState('domcontentloaded')
      
      // Check current URL
      const currentUrl = page.url()
      console.log(`${dayjs().format()} - Current URL: ${currentUrl}`)
      
      // DEBUG: Get page HTML to see what's actually there
      const pageHTML = await page.content().catch(() => '')
      const hasSlots = pageHTML.includes('creneau') || pageHTML.includes('slot') || pageHTML.includes('reserver') || pageHTML.includes('Réserver')
      console.log(`${dayjs().format()} - Page HTML contains slot keywords: ${hasSlots}`)
      
      // Save HTML for debugging
      writeFileSync(`img/page-html-${location}-${Date.now()}.html`, pageHTML)
      console.log(`${dayjs().format()} - Saved page HTML to img/ for inspection`)
      
      // Check for iframes
      const iframes = await page.$$('iframe').catch(() => [])
      console.log(`${dayjs().format()} - Found ${iframes.length} iframes on page`)
      
      // Check for collapsed/expandable panels
      const panels = await page.$$('.panel, .collapse, [class*="panel"], [class*="collapse"], [data-toggle="collapse"]').catch(() => [])
      console.log(`${dayjs().format()} - Found ${panels.length} potential collapsible panels`)
      
      // Try to find any elements with time information - comprehensive search
      try {
        const timeElements = await page.evaluate(() => {
          const allElements = Array.from(document.querySelectorAll('*'))
          const results = []
          
          for (const el of allElements) {
            try {
              const text = (el.textContent || '').trim()
              const onclick = el.getAttribute('onclick') || ''
              const href = el.getAttribute('href') || ''
              const className = el.className || ''
              const id = el.id || ''
              
              // Check if element contains time info (21h, 20h, etc.) and is clickable
              const hasTime = /(21h|20h|19h|18h|17h|16h|15h|14h|13h|12h|11h|10h|09h|08h|\d{1,2}:\d{2})/i.test(text + onclick + href)
              const isClickable = el.tagName === 'A' || el.tagName === 'BUTTON' || 
                                el.onclick || href.includes('reservation') || href.includes('creneau') ||
                                onclick.includes('reservation') || onclick.includes('creneau') ||
                                className.toLowerCase().includes('book') || className.toLowerCase().includes('reserve') || 
                                className.toLowerCase().includes('creneau') || id.toLowerCase().includes('book') || 
                                id.toLowerCase().includes('reserve') || id.toLowerCase().includes('creneau')
              
              if (hasTime && isClickable && text.length < 200) {
                // Get a unique selector for this element
                let selector = el.tagName.toLowerCase()
                if (id) selector += `#${id}`
                if (className) selector += `.${className.split(' ')[0]}`
                
                results.push({
                  tag: el.tagName,
                  selector: selector,
                  text: text.substring(0, 80),
                  onclick: onclick.substring(0, 150),
                  href: href.substring(0, 150),
                  className: className.substring(0, 100),
                  id: id.substring(0, 50)
                })
              }
            } catch (e) {
              continue
            }
          }
          
          return results.slice(0, 20) // Return first 20 matches
        })
        
        if (timeElements && timeElements.length > 0) {
          console.log(`${dayjs().format()} - ✅ Found ${timeElements.length} clickable elements with time info:`)
          timeElements.forEach((elem, i) => {
            console.log(`${dayjs().format()} -   ${i+1}. <${elem.tag}> selector="${elem.selector}"`)
            console.log(`${dayjs().format()} -      text: "${elem.text}"`)
            if (elem.onclick) console.log(`${dayjs().format()} -      onclick: "${elem.onclick.substring(0, 80)}"`)
            if (elem.href) console.log(`${dayjs().format()} -      href: "${elem.href.substring(0, 80)}"`)
          })
        } else {
          console.log(`${dayjs().format()} - ⚠️ No clickable elements with time info found in page`)
        }
      } catch (e) {
        console.log(`${dayjs().format()} - Error searching for time elements: ${e.message}`)
      }
      
      // Debug: Check what page we're on
      const pageTitle = await page.title()
      console.log(`${dayjs().format()} - After search, page title: ${pageTitle}`)
      
      // Check what's actually on the page - try multiple selectors (note: it's dateDeb, not datedeb!)
      const allDateElements = await page.$$('[dateDeb], [datedeb]').catch(() => [])
      console.log(`${dayjs().format()} - Found ${allDateElements.length} elements with [dateDeb] or [datedeb] attribute`)
      
      // Also check for other possible selectors
      const panelTitles = await page.$$('.panel-title').catch(() => [])
      console.log(`${dayjs().format()} - Found ${panelTitles.length} .panel-title elements`)
      
      const courtElements = await page.$$('.court').catch(() => [])
      console.log(`${dayjs().format()} - Found ${courtElements.length} .court elements`)
      
      // Try alternative selectors for slots
      const creneauElements = await page.$$('.creneau, [class*="creneau"], [class*="slot"]').catch(() => [])
      console.log(`${dayjs().format()} - Found ${creneauElements.length} creneau/slot elements`)
      
      let foundSlot = false // Initialize flag for slot detection
      let selectedHour = null
      
      // Check for any clickable booking buttons - try multiple selectors
      const bookSelectors = [
        'button[onclick*="reservation"]',
        'a[href*="reservation"]',
        '[class*="book"]',
        '[class*="reserve"]',
        '[onclick*="creneau"]',
        'button:has-text("Réserver")',
        'a:has-text("Réserver")',
        '.btn-reserver',
        '[data-action="reserver"]'
      ]
      
      let bookButtons = []
      for (const selector of bookSelectors) {
        const buttons = await page.$$(selector).catch(() => [])
        if (buttons.length > 0) {
          console.log(`${dayjs().format()} - Found ${buttons.length} elements with selector: ${selector}`)
          bookButtons.push(...buttons)
        }
      }
      
      // Remove duplicates
      bookButtons = [...new Set(bookButtons)]
      console.log(`${dayjs().format()} - Found ${bookButtons.length} total booking buttons`)
      
      // If we found booking buttons, try clicking the first one
      // Try clicking booking buttons if we found any - but also look for time-based elements
      if (!foundSlot && bookButtons.length > 0) {
        console.log(`${dayjs().format()} - Trying to find and click actual slot buttons`)
        
        // Look for elements that contain hour information
        const allClickable = await page.$$('a, button, [onclick], [href*="reservation"], [href*="creneau"]').catch(() => [])
        console.log(`${dayjs().format()} - Found ${allClickable.length} clickable elements to check`)
        
        // Try each hour in priority order
        for (const hour of config.hours) {
          if (foundSlot) break
          
          console.log(`${dayjs().format()} - Looking for slots at ${hour}:00 (${hour}h)`)
          for (const elem of allClickable) {
            try {
              const text = await elem.textContent().catch(() => '') || ''
              const onclick = await elem.getAttribute('onclick').catch(() => '') || ''
              const href = await elem.getAttribute('href').catch(() => '') || ''
              const isVisible = await elem.isVisible().catch(() => false)
              
              // Check if this element is for our target hour
              const hourStr = `${hour}h`
              const hourStr2 = `${hour}:00`
              if (isVisible && (text.includes(hourStr) || onclick.includes(hourStr2) || href.includes(hourStr) || 
                  text.includes(hourStr2) || onclick.includes(hourStr))) {
                console.log(`${dayjs().format()} - Found potential slot for ${hour}:00 - clicking`)
                console.log(`${dayjs().format()} - Element text: ${text.trim().substring(0, 80)}`)
                await elem.click()
                await new Promise(resolve => setTimeout(resolve, 3000))
                const newPageTitle = await page.title()
                const newUrl = page.url()
                console.log(`${dayjs().format()} - After click: title="${newPageTitle}", URL="${newUrl}"`)
                
                if (newPageTitle.includes('Reservation') || newPageTitle.includes('Réservation') || 
                    newUrl.includes('reservation')) {
                  console.log(`${dayjs().format()} - ✅ Successfully navigated to reservation page!`)
                  selectedHour = hour
                  foundSlot = true
                  break
                }
              }
            } catch (e) {
              continue
            }
          }
        }
      }
      
      if (allDateElements.length > 0) {
        // Get a few examples to see the format
        for (let i = 0; i < Math.min(3, allDateElements.length); i++) {
          const dateAttr = await allDateElements[i].getAttribute('datedeb').catch(() => 'none')
          console.log(`${dayjs().format()} - Example datedeb format: ${dateAttr}`)
        }
      } else {
        // Check for error messages or no results message
        const errorSelectors = ['.error', '.alert', '.message', '.no-results', '[class*="error"]', '[class*="alert"]', '[id*="error"]']
        for (const selector of errorSelectors) {
          const errorMsg = await page.$(selector).catch(() => null)
          if (errorMsg) {
            const errorText = await errorMsg.textContent().catch(() => '')
            if (errorText.trim()) {
              console.log(`${dayjs().format()} - Found message (${selector}): ${errorText.trim()}`)
            }
          }
        }
        
        // Check page content for common messages
        const pageText = await page.textContent('body').catch(() => '')
        if (pageText.includes('Aucun créneau') || pageText.includes('aucun résultat') || pageText.includes('Aucune disponibilité')) {
          console.log(`${dayjs().format()} - Page shows "no slots available" message`)
        }
        if (pageText.includes('erreur') || pageText.includes('error')) {
          console.log(`${dayjs().format()} - Page may contain error message`)
        }
        
        // Take screenshot to see what's on the page
        console.log(`${dayjs().format()} - No [datedeb] elements found, taking screenshot for debugging`)
        await page.screenshot({ path: `img/debug-${location}-${Date.now()}.png`, fullPage: true }).catch(() => {})
      }

      // Use original method - exactly as in the original repo
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
      
      const finalPageTitle = await page.title()
      console.log(`${dayjs().format()} - Final page title: ${finalPageTitle}`)
      
      if (finalPageTitle !== 'Paris | TENNIS - Reservation') {
        console.log(`${dayjs().format()} - Failed to find reservation for ${location} (not on reservation page)`)
        // Take screenshot for debugging
        await page.screenshot({ path: `img/no-reservation-${location}-${Date.now()}.png` }).catch(() => {})
        continue
      }
      
      // If we got here, we found a slot and are on reservation page
      console.log(`${dayjs().format()} - ✅ Successfully found and selected a slot for ${location}!`)

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
