# Tennis Booking Scheduler Status

## ✅ Ready for Automatic Booking

### Schedule Details
- **Execution Time**: Every day at 8:00 AM (local time)
- **Next Run**: Thursday, October 23, 2025 at 8:00 AM
- **Status**: Active and loaded in launchd

### Booking Configuration
- **Target Date**: Wednesday, October 29, 2025
- **Time**: 20:00 (8 PM)
- **Duration**: 1 hour
- **Priority Locations** (in order):
  1. **Édouard Pailleron** (Priority - Eduardo)
  2. Candie
  3. Poliveau

### Players
1. Oscar Moerke
2. Bean Grabowski

### Court Preferences
- **Price Types**: Tarif plein, Tarif réduit
- **Court Types**: Découvert (outdoor), Couvert (covered)

## System Setup

### LaunchAgent Configuration
- **Service Name**: com.tennis.booking
- **Config File**: `~/Library/LaunchAgents/com.tennis.booking.plist`
- **Working Directory**: `/Users/morkeeth/EVALUATOR/Booking`
- **Node Path**: `/Users/morkeeth/.nvm/versions/node/v18.17.1/bin/node`

### Logging
- **Standard Output**: `/Users/morkeeth/EVALUATOR/Booking/booking.log`
- **Error Output**: `/Users/morkeeth/EVALUATOR/Booking/booking.error.log`

## Management Commands

### Check if service is running
```bash
launchctl list | grep tennis
```

### View logs
```bash
# Standard output
cat /Users/morkeeth/EVALUATOR/Booking/booking.log

# Errors
cat /Users/morkeeth/EVALUATOR/Booking/booking.error.log
```

### Stop the scheduler
```bash
launchctl unload ~/Library/LaunchAgents/com.tennis.booking.plist
```

### Restart the scheduler
```bash
launchctl unload ~/Library/LaunchAgents/com.tennis.booking.plist
launchctl load ~/Library/LaunchAgents/com.tennis.booking.plist
```

### Manual test run (WARNING: Will attempt real booking!)
```bash
cd /Users/morkeeth/EVALUATOR/Booking
npm start
```

## Important Notes

1. **Computer must be on** - Your Mac needs to be powered on and awake at 8 AM for the booking to execute
2. **Internet connection** - Active internet connection required
3. **Valid carnet** - Ensure you have a valid "carnet de réservation" that matches your price/court type preferences
4. **First available** - The script will book the first available court matching your criteria in the priority order
5. **AI CAPTCHA solver** - Using Hugging Face space: `FatBoyEnglish/Text_Captcha_breaker`

## Verification Checklist

- [x] Config date set to 29/10/2025 (Wednesday 29th)
- [x] Time set to 20:00 (8 PM)
- [x] Édouard Pailleron as priority location
- [x] LaunchAgent installed and loaded
- [x] Dependencies installed
- [x] Node path configured correctly
- [x] Logs configured for monitoring

---
*Last Updated: October 22, 2025*
*Next Scheduled Run: October 23, 2025 at 8:00 AM*

