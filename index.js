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
      await page.goto('https://tennis.paris.fr/tennis/jsp/site/Portal.jsp?page=recherche&view=rechercher_creneau', { waitUntil: 'domcontentloaded' })

      // select tennis location - must actually select from dropdown
      const locationInput = page.locator('.tokens-input-text')
      await locationInput.click()
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Type location name
      await locationInput.fill(location)
      console.log(`${dayjs().format()} - Typed location: ${location}`)
      
      // Wait for suggestions dropdown to appear
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Try to find and click the suggestion - CRITICAL: must click a suggestion
      let locationSelected = false
      try {
        // Wait for suggestions list to appear
        await page.waitForSelector('.tokens-suggestions-list-element', { timeout: 15000, state: 'visible' })
        const suggestions = await page.$$('.tokens-suggestions-list-element')
        console.log(`${dayjs().format()} - Found ${suggestions.length} location suggestions`)
        
        if (suggestions.length === 0) {
          throw new Error('No suggestions found')
        }
        
        // Try to find matching suggestion (flexible matching)
        for (const suggestion of suggestions) {
          const text = await suggestion.textContent().catch(() => '')
          const cleanText = text.trim()
          console.log(`${dayjs().format()} - Checking suggestion: "${cleanText}"`)
          
          // Match if location name is in suggestion or vice versa
          const locationClean = location.replace('Tennis ', '').trim()
          if (cleanText.includes(location) || cleanText.includes(locationClean) || 
              location.includes(cleanText.replace('Tennis ', '')) || 
              locationClean === cleanText.replace('Tennis ', '')) {
            await suggestion.click()
            locationSelected = true
            console.log(`${dayjs().format()} - ✅ Selected location: ${cleanText}`)
            await new Promise(resolve => setTimeout(resolve, 500))
            break
          }
        }
        
        // If no exact match, click FIRST suggestion (it's usually the right one)
        if (!locationSelected && suggestions.length > 0) {
          await suggestions[0].click()
          const firstText = await suggestions[0].textContent().catch(() => '')
          locationSelected = true
          console.log(`${dayjs().format()} - ✅ Selected first suggestion: ${firstText.trim()}`)
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      } catch (e) {
        console.log(`${dayjs().format()} - ⚠️ Suggestions not found: ${e.message}, trying Enter key`)
        // Last resort: press Enter
        await locationInput.press('Enter')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      // Verify location is actually selected (should see a token/chip)
      const selectedTokens = await page.$$('.token, [class*="token"]').catch(() => [])
      console.log(`${dayjs().format()} - Found ${selectedTokens.length} selected location tokens`)
      
      if (selectedTokens.length === 0) {
        console.log(`${dayjs().format()} - ⚠️ WARNING: No location token found - location may not be selected!`)
        // Try one more time with Enter
        await locationInput.press('Enter')
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        const tokenText = await selectedTokens[0].textContent().catch(() => '')
        console.log(`${dayjs().format()} - ✅ Location token confirmed: ${tokenText.trim()}`)
      }

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
      console.log(`${dayjs().format()} - Clicked search button`)

      // Wait for AJAX call to complete - the slots are loaded via AJAX
      console.log(`${dayjs().format()} - Waiting for AJAX search results to load`)
      
      // Wait for the AJAX response - look for network request to ajax_rechercher_creneau
      try {
        await page.waitForResponse(response => 
          response.url().includes('ajax_rechercher_creneau'), 
          { timeout: 30000 }
        )
        console.log(`${dayjs().format()} - AJAX response received`)
      } catch (e) {
        console.log(`${dayjs().format()} - AJAX wait timeout: ${e.message}`)
      }
      
      // Wait for results to render in DOM
      try {
        await page.waitForSelector('[dateDeb], [datedeb], .creneaux, li:not(.masked)', { timeout: 20000 })
        console.log(`${dayjs().format()} - Results rendered in DOM`)
      } catch (e) {
        console.log(`${dayjs().format()} - Results selector timeout: ${e.message}`)
      }
      
      // Additional wait for JavaScript to render results
      await new Promise(resolve => setTimeout(resolve, 3000))
      
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

      // Direct approach: Find all available (unmasked) slots first
      if (!foundSlot) {
        console.log(`${dayjs().format()} - 🔍 Searching for available (unmasked) slots`)
        
        const availableSlots = await page.evaluate((targetHours) => {
          const results = []
          // Find all li elements that contain hour info
          const allLis = Array.from(document.querySelectorAll('li'))
          
          for (const li of allLis) {
            const text = li.textContent || ''
            const isMasked = li.classList.contains('masked')
            
            // Check if this li contains any of our target hours and is NOT masked
            for (const hour of targetHours) {
              if (text.includes(`${hour}h`) && !isMasked) {
                // Find clickable parent or sibling
                let clickable = li.closest('a, button, [onclick], [href], [dateDeb], [datedeb]')
                if (!clickable && li.parentElement) {
                  clickable = li.parentElement.closest('a, button, [onclick], [href]')
                }
                if (!clickable) {
                  // Check siblings
                  const siblings = Array.from(li.parentElement?.children || [])
                  clickable = siblings.find(s => s.tagName === 'A' || s.tagName === 'BUTTON' || s.onclick)
                }
                
                if (clickable) {
                  results.push({
                    hour: hour,
                    text: text.trim(),
                    tag: clickable.tagName,
                    hasOnclick: !!clickable.onclick,
                    hasHref: !!clickable.href,
                    dateDeb: clickable.getAttribute('dateDeb') || clickable.getAttribute('datedeb') || ''
                  })
                }
              }
            }
          }
          
          return results
        }, config.hours).catch(() => [])
        
        if (availableSlots && availableSlots.length > 0) {
          console.log(`${dayjs().format()} - ✅ Found ${availableSlots.length} available slots!`)
          availableSlots.forEach((s, i) => {
            console.log(`${dayjs().format()} -   ${i+1}. ${s.hour}:00 - ${s.tag} - dateDeb: "${s.dateDeb}"`)
          })
          
          // Try clicking in priority order
          for (const hour of config.hours) {
            const slotsForHour = availableSlots.filter(s => s.hour === hour)
            if (slotsForHour.length > 0) {
              console.log(`${dayjs().format()} - Attempting to click slot for ${hour}:00`)
              
              // Try to find and click using dateDeb attribute
              if (slotsForHour[0].dateDeb) {
                try {
                  const elem = await page.$(`[dateDeb="${slotsForHour[0].dateDeb}"], [datedeb="${slotsForHour[0].dateDeb}"]`).catch(() => null)
                  if (elem) {
                    const isVisible = await elem.isVisible().catch(() => false)
                    if (isVisible) {
                      console.log(`${dayjs().format()} - Clicking slot with dateDeb="${slotsForHour[0].dateDeb}"`)
                      await elem.click()
                      selectedHour = hour
                      await new Promise(resolve => setTimeout(resolve, 3000))
                      
                      const newPageTitle = await page.title()
                      if (newPageTitle.includes('Reservation') || newPageTitle.includes('Réservation')) {
                        console.log(`${dayjs().format()} - ✅ Successfully navigated to reservation page!`)
                        foundSlot = true
                        break
                      }
                    }
                  }
                } catch (e) {
                  console.log(`${dayjs().format()} - Error: ${e.message}`)
                }
              }
              
              // Fallback: try clicking li elements directly
              if (!foundSlot) {
                const lis = await page.$$('li').catch(() => [])
                for (const li of lis) {
                  try {
                    const text = await li.textContent().catch(() => '')
                    const isMasked = await li.evaluate(el => el.classList.contains('masked')).catch(() => true)
                    if (text.includes(`${hour}h`) && !isMasked) {
                      console.log(`${dayjs().format()} - Clicking unmasked li element for ${hour}h`)
                      await li.click()
                      selectedHour = hour
                      await new Promise(resolve => setTimeout(resolve, 3000))
                      
                      const newPageTitle = await page.title()
                      if (newPageTitle.includes('Reservation') || newPageTitle.includes('Réservation')) {
                        console.log(`${dayjs().format()} - ✅ Successfully navigated to reservation page!`)
                        foundSlot = true
                        break
                      }
                    }
                  } catch (e) {
                    continue
                  }
                }
              }
              
              if (foundSlot) break
            }
          }
        }
      }
      
      // Only try hour-by-hour search if we haven't found a slot yet
      if (!foundSlot) {
      hoursLoop:
      for (const hour of config.hours) {
        // Try both dateDeb and datedeb (case sensitive!)
        const dateDebSelector1 = `[dateDeb*="${date.format('YYYY/MM/DD')}"][dateDeb*="${hour}:00"]`
        const dateDebSelector2 = `[datedeb="${date.format('YYYY/MM/DD')} ${hour}:00:00"]`
        const dateDebSelector3 = `[dateDeb="${date.format('YYYY/MM/DD')} ${hour}:00:00"]`
        console.log(`${dayjs().format()} - Checking hour ${hour}:00 for date ${date.format('YYYY/MM/DD')}`)
        
        // Try original selector first - try multiple variations
        let hourElement = await page.$(dateDebSelector1).catch(() => null) ||
                         await page.$(dateDebSelector2).catch(() => null) ||
                         await page.$(dateDebSelector3).catch(() => null)
        let slots = []
        
        if (hourElement) {
          console.log(`${dayjs().format()} - Found hour ${hour}:00 element using [dateDeb]`)
          // Try to get all slots for this hour
          slots = await page.$$(dateDebSelector1).catch(() => []) ||
                  await page.$$(dateDebSelector2).catch(() => []) ||
                  await page.$$(dateDebSelector3).catch(() => [])
          
          // Also try clicking unmasked time slots - these are the available ones!
          const unmaskedSlots = await page.evaluate((hour) => {
            const allLis = Array.from(document.querySelectorAll('li'))
            return allLis
              .filter(li => li.textContent.includes(`${hour}h`) && !li.classList.contains('masked'))
              .slice(0, 10)
          }, hour).catch(() => [])
          
          if (unmaskedSlots && unmaskedSlots.length > 0) {
            console.log(`${dayjs().format()} - ✅ Found ${unmaskedSlots.length} unmasked (available) slots for ${hour}h`)
            // Get the actual elements
            const unmaskedElements = await page.$$(`li:not(.masked)`).catch(() => [])
            for (const elem of unmaskedElements) {
              const text = await elem.textContent().catch(() => '')
              if (text.includes(`${hour}h`)) {
                slots.push(elem)
              }
            }
          }
          
          // Also look for clickable elements near time slots
          const timeSlotParents = await page.evaluate((hour) => {
            const allElements = Array.from(document.querySelectorAll('*'))
            const results = []
            for (const el of allElements) {
              const text = (el.textContent || '').trim()
              if (text.includes(`${hour}h`) && !text.includes('masked')) {
                // Find parent or sibling that's clickable
                let clickable = el.closest('a, button, [onclick], [href]')
                if (!clickable && el.parentElement) {
                  clickable = el.parentElement.closest('a, button, [onclick], [href]')
                }
                if (clickable) results.push(clickable)
              }
            }
            return results.slice(0, 5).map(el => ({
              tag: el.tagName,
              text: (el.textContent || '').trim().substring(0, 50),
              onclick: el.getAttribute('onclick') || '',
              href: el.getAttribute('href') || ''
            }))
          }, hour).catch(() => [])
          
          if (timeSlotParents && timeSlotParents.length > 0) {
            console.log(`${dayjs().format()} - Found ${timeSlotParents.length} clickable elements near ${hour}h slots`)
            // Try to find and click these elements
            for (const info of timeSlotParents) {
              try {
                const selector = info.tag.toLowerCase() + (info.onclick ? '[onclick*="' + info.onclick.substring(0, 30) + '"]' : '') + 
                                (info.href ? '[href*="' + info.href.substring(0, 30) + '"]' : '')
                const elem = await page.$(selector).catch(() => null)
                if (elem) slots.push(elem)
              } catch (e) {
                continue
              }
            }
          }
        } else {
          // Try alternative selectors - look for any clickable slot elements
          console.log(`${dayjs().format()} - Trying alternative selectors for hour ${hour}:00`)
          
          // Try finding elements that contain the hour
          const allClickable = await page.$$(`button, a, [onclick], [class*="book"], [class*="reserve"], [class*="creneau"]`).catch(() => [])
          console.log(`${dayjs().format()} - Found ${allClickable.length} potentially clickable elements`)
          
          // Look for elements with time/hour in text or attributes
          for (const elem of allClickable) {
            try {
              const text = await elem.textContent().catch(() => '') || ''
              const onclick = await elem.getAttribute('onclick').catch(() => '') || ''
              const href = await elem.getAttribute('href').catch(() => '') || ''
              
              // Check if this element is for our target hour and date
              const matchesHour = text.includes(`${hour}h`) || onclick.includes(`${hour}:00`) || href.includes(`${hour}`)
              const matchesDate = onclick.includes(date.format('YYYY/MM/DD')) || href.includes(date.format('YYYY/MM/DD')) || text.includes(date.format('DD/MM'))
              
              if (matchesHour && matchesDate) {
                slots.push(elem)
                console.log(`${dayjs().format()} - Found potential slot element: ${text.substring(0, 50)}`)
              }
            } catch (e) {
              // Skip this element if there's an error
              continue
            }
          }
        }
        
        console.log(`${dayjs().format()} - Found ${slots.length} slots for hour ${hour}:00`)
        
        if (slots.length > 0) {
          // Try to book the first available slot
          for (const slot of slots) {
            try {
              // Check if it matches our filters (if we can determine price/court type)
              const slotText = await slot.textContent().catch(() => '')
              console.log(`${dayjs().format()} - Attempting to book slot: ${slotText.substring(0, 50)}`)
              
              // Click the slot
              await slot.click()
              selectedHour = hour
              console.log(`${dayjs().format()} - ✅ Clicked slot for ${hour}:00`)
              
              // Wait a bit to see if we navigated to booking page
              await new Promise(resolve => setTimeout(resolve, 2000))
              foundSlot = true
              break hoursLoop // Found a slot, exit the loop
            } catch (e) {
              console.log(`${dayjs().format()} - Failed to click slot: ${e.message}`)
              continue
            }
          }
        } else {
          console.log(`${dayjs().format()} - No slots found for hour ${hour}:00`)
        }
        } // end hoursLoop
      } // end if !foundSlot
      
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
