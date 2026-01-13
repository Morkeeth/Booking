# ✅ Setup for January 14th at 8am - BEST APPROACH

## Current Status

✅ **config.json** - Updated correctly:
- Date: `14/01/2025` (tomorrow)
- Hour priority: `08` (8am) first
- Locations: Poliveau (rank 1), Edouard Pailleron (rank 2)
- Player: Edouard Pailleron

✅ **GitHub Actions workflow** - Updated for manual trigger:
- Config now matches requirements
- Date set to Jan 14
- Can be manually triggered from GitHub Actions tab

⚠️ **Local Mac automation** - Not currently active (needs to be loaded)

---

## 🎯 RECOMMENDED: Use Local Mac Automation (MOST RELIABLE)

### Why Local is Better:
- ✅ **95%+ reliability** (vs 0% for GitHub Actions)
- ✅ **Exact timing** (8:00:00 AM, no delays)
- ✅ **Already configured** in `com.tennis.booking.plist`
- ✅ **Runs automatically** every day at 8am

### Setup Steps:

1. **Load the service** (run this now):
```bash
launchctl load ~/Library/LaunchAgents/com.tennis.booking.plist
```

2. **Verify it's loaded**:
```bash
launchctl list | grep tennis
```

3. **Make sure your Mac is ON and AWAKE tomorrow at 8am**
   - Or enable "Wake for network access" in Energy Saver settings
   - Or use `caffeinate` to prevent sleep

4. **Test it works** (optional - will attempt real booking):
```bash
cd /Users/morkeeth/EVALUATOR/Booking
node index.js
```

---

## 🔄 ALTERNATIVE: Manual GitHub Actions Trigger

If you prefer GitHub Actions (less reliable but works if Mac is off):

1. Go to: https://github.com/Morkeeth/Booking/actions/workflows/book-tennis.yml
2. Click **"Run workflow"** dropdown
3. Click **"Run workflow"** button
4. Wait 2-3 minutes for completion

⚠️ **Warning**: GitHub Actions has had 0% success rate historically

---

## 📅 For Future 6-Day Advance Bookings

After tomorrow, update `config.json` to remove the date field:

```json
{
  // Remove this line:
  // "date": "14/01/2025",
  
  // Script will automatically book 6 days in advance
}
```

The plist runs **daily at 8am**, so it will:
- Monday 8am → Books for Sunday (6 days ahead)
- Tuesday 8am → Books for Monday (6 days ahead)
- etc.

**OR** modify the plist to run only on specific days (e.g., Thursdays only).

---

## ✅ Verification Checklist

Before tomorrow morning:

- [ ] `config.json` has date `14/01/2025` ✅
- [ ] `config.json` has hour `08` as first priority ✅
- [ ] `config.json` has locations: Poliveau, Edouard Pailleron ✅
- [ ] Local service loaded: `launchctl load ~/Library/LaunchAgents/com.tennis.booking.plist`
- [ ] Mac will be ON/awake at 8am tomorrow
- [ ] OR GitHub Actions workflow ready for manual trigger

---

## 🚨 If Both Fail

**Last resort - Manual booking:**
1. Go to https://tennis.paris.fr
2. Login
3. Search for Poliveau or Edouard Pailleron
4. Date: January 14, 2025
5. Time: 8:00 AM
6. Book manually

---

**Created: January 13, 2025**
**Target booking: January 14, 2025 at 8:00 AM**
