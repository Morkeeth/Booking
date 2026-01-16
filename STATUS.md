# Project Status & Post-Mortem

## Current Status: ❌ NOT WORKING

**Last Test:** January 16, 2026, 8:00 AM  
**Result:** Script too slow - missed 7pm/8pm slots. User manually booked 6pm slot.

## Post-Mortem: Why This Took Months

### The Problem
Automated tennis court booking for Paris Tennis website (tennis.paris.fr) - slots open at 8 AM, need to book 6 days in advance.

### Why It's Been Difficult

1. **Website Structure Changes**
   - Site uses AJAX for slot loading (not static HTML)
   - Selectors change: `datedeb` vs `dateDeb` (case sensitivity issues)
   - Slots are "masked" (unavailable) vs clickable - hard to detect
   - Page structure differs from original repository

2. **Timing Issues**
   - Booking window opens at 8 AM sharp
   - Script takes 2+ minutes to run (too slow)
   - By the time script completes, 7pm/8pm slots are gone
   - Need sub-30 second execution time

3. **Location Selection Problems**
   - Location dropdown suggestions timeout
   - Exact name matching fails ("Tennis Edouard Pailleron" vs variations)
   - `pressSequentially()` too slow, `fill()` doesn't always work

4. **Slot Detection Failures**
   - Original repo uses `[datedeb]` selector - doesn't find elements
   - Slots loaded via AJAX - hard to wait for completion
   - No reliable way to detect "available" vs "masked" slots
   - Clicking wrong elements (li tags vs actual booking buttons)

5. **CAPTCHA Complications**
   - CAPTCHA appears during booking process
   - AI solver (Hugging Face) sometimes fails
   - Adds delay to already slow process

6. **Scheduling Reliability**
   - GitHub Actions unreliable (timing issues, auto-disables)
   - Local Mac automation (launchd) more reliable but requires Mac to stay on
   - No cloud execution option that's reliable

### What Works
- ✅ Login successful
- ✅ Location selection (sometimes)
- ✅ Date selection
- ✅ Search executes
- ✅ Can detect slots exist (but can't click them reliably)

### What Doesn't Work
- ❌ Fast enough execution (< 30 seconds)
- ❌ Reliable slot detection and clicking
- ❌ Consistent location selection
- ❌ Automated booking completion

### Lessons Learned

1. **Website automation is fragile** - small changes break everything
2. **Speed matters** - 2 minutes is too slow for competitive booking
3. **Original repos may be outdated** - site structure changes
4. **AJAX-heavy sites are hard** - timing is critical
5. **Manual booking is still faster** - user can book in 10 seconds

### Recommendation

**Abandon automated approach** - manual booking is:
- Faster (10 seconds vs 2+ minutes)
- More reliable (100% success rate)
- Less maintenance (no code to update)
- Less frustration

If continuing automation:
- Need sub-30 second execution
- Better slot detection (inspect actual DOM structure)
- Faster location selection (pre-fill or cache)
- More reliable CAPTCHA handling

---

**Status:** Project paused - manual booking preferred until fundamental issues resolved.
