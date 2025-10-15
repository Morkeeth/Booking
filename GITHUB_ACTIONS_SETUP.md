# GitHub Actions Setup Guide

## Quick Start

Your tennis booking automation is now ready to run via GitHub Actions! Follow these steps to get it running:

### 1. Push to GitHub

First, push this repository to GitHub:

```bash
git add .
git commit -m "Add GitHub Actions automation for tennis booking"
git push origin master
```

If you haven't set up a GitHub repository yet:

```bash
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin master
```

### 2. Configure GitHub Secrets

Go to your repository on GitHub:
1. Click **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

#### Required Secrets:

- **TENNIS_EMAIL**: Your tennis.paris.fr account email
- **TENNIS_PASSWORD**: Your tennis.paris.fr account password

#### Optional Secrets (examples provided):

- **TENNIS_LOCATIONS**: 
  ```json
  ["Valeyre", "Suzanne Lenglen", "Poliveau"]
  ```

- **TENNIS_HOURS**: 
  ```json
  ["14", "15", "16", "10", "11"]
  ```

- **TENNIS_PLAYERS**: 
  ```json
  [{"lastName": "Doe", "firstName": "John"}, {"lastName": "Smith", "firstName": "Jane"}]
  ```

- **TENNIS_PRICE_TYPE**: 
  ```json
  ["Tarif plein", "Tarif réduit"]
  ```

- **TENNIS_COURT_TYPE**: 
  ```json
  ["Découvert", "Couvert"]
  ```

- **NTFY_ENABLE**: `true` (if you want mobile notifications)

- **NTFY_TOPIC**: `your-unique-topic-name` (for ntfy notifications)

### 3. Adjust Timezone (if needed)

The workflow runs at 8:00 AM UTC by default. To adjust for your timezone:

1. Open `.github/workflows/book-tennis.yml`
2. Find the cron schedule line: `- cron: '0 8 * * *'`
3. Change the hour to match your timezone:
   - **8 AM EST**: `'0 13 * * *'` (UTC-5)
   - **8 AM PST**: `'0 16 * * *'` (UTC-8)
   - **8 AM CET**: `'0 7 * * *'` (UTC+1)

### 4. Test the Workflow

To test without waiting for the scheduled time:

1. Go to the **Actions** tab in your GitHub repository
2. Click **"Book Tennis Court"** workflow
3. Click **"Run workflow"** button
4. Click the green **"Run workflow"** button in the dropdown

### 5. Monitor Execution

- View workflow runs in the **Actions** tab
- Click on any run to see detailed logs
- If a run fails, screenshots will be uploaded as artifacts for debugging
- Download artifacts from the failed workflow run page

## How It Works

1. **Scheduling**: The workflow runs daily at 8 AM (UTC) automatically
2. **Config Generation**: Secrets are used to generate `config.json` on-the-fly
3. **Booking**: The script books a court 6 days in advance
4. **Notifications**: If ntfy is enabled, you'll get a mobile notification with booking details
5. **Debugging**: Failed runs save screenshots to help troubleshoot issues

## Important Notes

- GitHub Actions runs in UTC timezone - adjust your cron schedule accordingly
- The script books courts **6 days in advance** by default
- You need a "carnet de réservation" in your Paris Tennis account
- The carnet must match your `priceType` & `courtType` combination
- You can manually trigger the workflow anytime from the Actions tab

## Troubleshooting

**Workflow not running:**
- Check that you've pushed the workflow file to GitHub
- Verify the workflow is enabled in the Actions tab

**Authentication errors:**
- Double-check your TENNIS_EMAIL and TENNIS_PASSWORD secrets
- Make sure there are no extra spaces in the secret values

**No courts available:**
- Adjust your TENNIS_HOURS to include more time slots
- Add more locations to TENNIS_LOCATIONS
- Check if you have a valid "carnet de réservation"

**CAPTCHA failures:**
- The script uses AI to solve CAPTCHAs automatically
- If it fails repeatedly, the Hugging Face space might be down
- Check the workflow logs for specific error messages

## Need Help?

Check the main [README.md](README.md) for detailed information about configuration options and the booking process.

