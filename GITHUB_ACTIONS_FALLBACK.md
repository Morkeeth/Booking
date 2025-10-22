# GitHub Actions Fallback Setup

This document explains how to set up GitHub Actions as a fallback scheduling method. This is useful if your local computer is turned off or loses internet connection at 8 AM.

## Why Use GitHub Actions as Fallback?

- **Reliability**: Runs on GitHub's servers, independent of your local machine
- **Redundancy**: Works even if your computer is off or offline
- **Free**: GitHub Actions is free for public repositories (and has generous limits for private repos)
- **Cloud-based**: No need to keep your computer running

## Setup Instructions

### 1. Push Repository to GitHub

```bash
cd /Users/morkeeth/EVALUATOR/Booking

# Initialize git if not already done
git init

# Add GitHub remote (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Add files (excluding config.json which contains sensitive data)
git add .
git commit -m "Add tennis booking automation with GitHub Actions"
git push -u origin master
```

**Important**: Do NOT commit `config.json` as it contains your password!

### 2. Configure GitHub Secrets

Go to your repository on GitHub:
1. Click **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

#### Required Secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `TENNIS_EMAIL` | Your tennis.paris.fr email | `omorke@gmail.com` |
| `TENNIS_PASSWORD` | Your tennis.paris.fr password | `YourPassword123!` |
| `TENNIS_PLAYERS` | JSON array of players | `[{"lastName":"Moerke","firstName":"Oscar"},{"lastName":"Grabowski","firstName":"Bean"}]` |

#### Optional Secrets:

| Secret Name | Value | Default |
|------------|-------|---------|
| `NTFY_ENABLE` | Enable notifications | `false` |
| `NTFY_TOPIC` | Your ntfy topic | `YOUR-OWN-TOPIC` |

### 3. Verify Workflow Schedule

The workflow is configured to run at:
- **6:00 AM UTC** = **8:00 AM CEST** (Central European Summer Time)

If you need a different timezone:

| Timezone | Local Time | UTC Time | Cron Expression |
|----------|-----------|----------|----------------|
| CET (Winter) | 8:00 AM | 7:00 AM | `0 7 * * *` |
| CEST (Summer) | 8:00 AM | 6:00 AM | `0 6 * * *` |
| EST | 8:00 AM | 1:00 PM | `0 13 * * *` |
| PST | 8:00 AM | 4:00 PM | `0 16 * * *` |

Edit `.github/workflows/book-tennis.yml` line 5 to change the schedule.

### 4. Enable GitHub Actions

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. If prompted, click **I understand my workflows, go ahead and enable them**

### 5. Test the Workflow

#### Manual Test:
1. Go to **Actions** tab
2. Click **Book Tennis Court** workflow
3. Click **Run workflow** dropdown
4. Click **Run workflow** button

⚠️ **Warning**: This will attempt a real booking!

### 6. Monitor Executions

- **View Runs**: Go to Actions tab to see all workflow executions
- **Logs**: Click on any run to see detailed logs
- **Artifacts**: Failed runs will upload screenshots for debugging
- **Notifications**: You can configure GitHub to email you on workflow failures

## Current Configuration

The GitHub Actions workflow is configured to book:

- **Date**: Wednesday, October 29, 2025
- **Time**: 20:00 (8 PM)
- **Locations** (priority order):
  1. Édouard Pailleron
  2. Candie
  3. Poliveau
- **Players**: Oscar Moerke, Bean Grabowski

## Updating the Booking Date

To change the booking date for future weeks:

1. Edit `.github/workflows/book-tennis.yml`
2. Find the line: `"date": "29/10/2025",`
3. Update to your new date in format `DD/MM/YYYY`
4. Commit and push changes

```bash
git add .github/workflows/book-tennis.yml
git commit -m "Update booking date to [NEW_DATE]"
git push
```

## Dual Scheduling Strategy

With both local launchd and GitHub Actions:

1. **Primary**: Local Mac (launchd) runs at 8:00 AM local time
2. **Fallback**: GitHub Actions runs at 8:00 AM CEST

This gives you redundancy - if one fails or your computer is off, the other will still run.

## Troubleshooting

### Check if workflow ran:
1. Go to GitHub → Actions tab
2. Look for runs on the scheduled date
3. Click on a run to see logs

### Workflow didn't run:
- Check if Actions are enabled in repository settings
- Verify the cron schedule is correct for your timezone
- GitHub may delay scheduled runs by a few minutes during high load

### Booking failed:
1. Check the workflow logs for errors
2. Download the failure screenshots from Artifacts
3. Verify your secrets are set correctly
4. Ensure you have a valid carnet de réservation

## Security Notes

- Never commit `config.json` to git (it's in `.gitignore`)
- Use GitHub Secrets for all sensitive data
- Secrets are encrypted and only exposed during workflow execution
- Regularly rotate your tennis.paris.fr password

---
*Created: October 22, 2025*
*Next scheduled GitHub Actions run: October 23, 2025 at 6:00 AM UTC (8:00 AM CEST)*

