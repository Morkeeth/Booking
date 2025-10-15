# 🚀 Ready to Push! Final Steps

## ✅ What's Been Done

1. ✅ Configuration updated for 8 PM (20:00) booking on Wednesday, October 22nd
2. ✅ Players added: Oscar Moerke and Bean Grabowski
3. ✅ GitHub Actions workflow set for 8 AM CEST (tomorrow morning)
4. ✅ All files committed locally

## 🔥 PUSH TO GITHUB NOW

Run this command:

```bash
git push origin master
```

You'll be prompted to authenticate with GitHub.

## ⚙️ Configure GitHub Secrets (CRITICAL!)

After pushing, immediately go to:
**https://github.com/Morkeeth/Booking/settings/secrets/actions**

Click **"New repository secret"** and add these **EXACT** secrets:

### Required Secrets:

1. **Name:** `TENNIS_EMAIL`  
   **Value:** `omorke@gmail.com`

2. **Name:** `TENNIS_PASSWORD`  
   **Value:** `Oscar1994!`

3. **Name:** `TENNIS_LOCATIONS`  
   **Value:** `["Candie", "Poliveau", "Édouard Pailleron"]`

4. **Name:** `TENNIS_HOURS`  
   **Value:** `["20"]`

5. **Name:** `TENNIS_PLAYERS`  
   **Value:** `[{"lastName": "Moerke", "firstName": "Oscar"}, {"lastName": "Grabowski", "firstName": "Bean"}]`

6. **Name:** `TENNIS_PRICE_TYPE`  
   **Value:** `["Tarif plein", "Tarif réduit"]`

7. **Name:** `TENNIS_COURT_TYPE`  
   **Value:** `["Découvert", "Couvert"]`

### Optional: Add a specific date secret

8. **Name:** `TENNIS_DATE`  
   **Value:** `22/10/2025`

Then update `generate-config.js` to use this date from env var.

## 🎯 What Happens Tomorrow

At **8:00 AM CEST** (October 16th), GitHub Actions will:
1. Generate config from your secrets
2. Run the booking script
3. Book a court at Candie/Poliveau/Édouard Pailleron for **October 22nd at 8 PM**
4. Add Oscar Moerke and Bean Grabowski as players

## 🧪 Test Right Now (Optional)

To test immediately without waiting:

```bash
npm install
npm start
```

This will attempt the booking right now.

## 📍 To Manually Trigger Tomorrow Morning

Go to: **https://github.com/Morkeeth/Booking/actions**

1. Click "Book Tennis Court"
2. Click "Run workflow"
3. Click green "Run workflow" button

## 🔍 Monitor the Run

After it runs, check: **https://github.com/Morkeeth/Booking/actions**

You'll see the workflow run with logs showing success or any errors.

## ⚠️ Important Notes

- The workflow is set to run **every day at 8 AM CEST** automatically
- It will book for **October 22nd specifically** (because date is set in config.json)
- After October 22nd, remove the `date` field if you want it to book 6 days in advance automatically
- Your credentials are secure - `config.json` is NOT in Git (check with `git status`)

---

**NEXT STEP: Run `git push origin master` NOW!**

