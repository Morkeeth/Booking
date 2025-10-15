# Your Tennis Booking Setup - Ready to Deploy!

## 🔒 Security Note
Your credentials are saved in `config.json` which is in `.gitignore` - they will NOT be committed to Git.

## Option 1: Test Locally Right Now

You can test the booking immediately on your computer:

```bash
npm install
npm start
```

This will attempt to book a court 6 days in advance (for October 21st).

## Option 2: Set Up GitHub Actions for Tomorrow (October 16th at 8 AM)

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Add tennis booking automation"
git push origin master
```

### Step 2: Configure GitHub Secrets

Go to: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these secrets exactly as shown:

1. **TENNIS_EMAIL**
   ```
   omorke@gmail.com
   ```

2. **TENNIS_PASSWORD**
   ```
   Oscar1994!
   ```

3. **TENNIS_LOCATIONS**
   ```json
   ["Candie", "Poliveau", "Édouard Pailleron"]
   ```

4. **TENNIS_HOURS**
   ```json
   ["14", "15", "16", "10", "11", "12", "13"]
   ```

5. **TENNIS_PRICE_TYPE**
   ```json
   ["Tarif plein", "Tarif réduit"]
   ```

6. **TENNIS_COURT_TYPE**
   ```json
   ["Découvert", "Couvert"]
   ```

7. **TENNIS_PLAYERS**
   ```json
   []
   ```

### Step 3: Set Up for Tomorrow at 8 AM

#### Determine Your Timezone
Since today is Wednesday, October 15, 2025, and you want it to run tomorrow (Thursday) at 8 AM:

**If you're in Paris/CET timezone (UTC+2 in summer, UTC+1 in winter):**
- For 8 AM Paris time, use: `0 6 * * *` (6 AM UTC = 8 AM Paris time in October)

**If you're in EST timezone:**
- For 8 AM EST, use: `0 13 * * *` (1 PM UTC = 8 AM EST)

**If you're in PST timezone:**
- For 8 AM PST, use: `0 16 * * *` (4 PM UTC = 8 AM PST)

#### Update the Workflow File

Edit `.github/workflows/book-tennis.yml` and change line 6 to match your timezone:

```yaml
    - cron: '0 6 * * *'  # Change this based on your timezone
```

### Step 4: Manual Trigger for Tomorrow Morning

Since you specifically want it to run tomorrow:

1. Push your changes to GitHub
2. At 8 AM tomorrow, go to the **Actions** tab
3. Click **"Book Tennis Court"**
4. Click **"Run workflow"** → **"Run workflow"**

OR

Just let the cron schedule run automatically at 8 AM!

## What the Script Will Do

When it runs, it will:
1. Log into tennis.paris.fr with your account
2. Search for available courts at Candie, Poliveau, and Édouard Pailleron (in that order)
3. Try to book for 6 days from now (October 22nd if running on October 16th)
4. Try hours in order: 2 PM, 3 PM, 4 PM, 10 AM, 11 AM, 12 PM, 1 PM
5. Book the first available court
6. Send a confirmation

## Important Reminders

✅ Your credentials are secure:
- Local: `config.json` is in `.gitignore`
- GitHub: Stored as encrypted Secrets

✅ You need a "carnet de réservation" in your account

✅ The script books 6 days in advance automatically

✅ To book for a specific date, add this to your `config.json`:
```json
"date": "22/10/2025"
```

## Troubleshooting

**If it doesn't find courts:**
- Add more hours to the list
- Add more locations
- Check if you have credits in your carnet

**If you see CAPTCHA errors:**
- The script uses AI to solve them automatically
- Occasional failures are normal, it will retry

**To test without waiting:**
- Run `npm start` locally right now to see if everything works

## Need to Change Settings?

Edit `config.json` locally or update the GitHub Secrets to change:
- Preferred locations
- Time preferences  
- Player information
- Court type preferences

