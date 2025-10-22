# 🚨 URGENT: GitHub Actions Setup for Tomorrow 8 AM

## ✅ What's Done
- [x] Code pushed to GitHub
- [x] Workflow configured to run daily at 8:00 AM CEST (6:00 AM UTC)
- [x] Booking set for **Wednesday, October 29, 2025 at 20:00 (8 PM)**
- [x] Priority location: **Édouard Pailleron**

## ⚠️ REQUIRED: Set Up GitHub Secrets NOW

Since your computer will be OFF tomorrow at 8 AM, you **MUST** set up GitHub Secrets for the workflow to run.

### Quick Setup Steps:

1. **Go to your GitHub repository:**
   https://github.com/Morkeeth/Booking

2. **Navigate to Settings:**
   Click **Settings** → **Secrets and variables** → **Actions**

3. **Add these 3 REQUIRED secrets:**

   Click "**New repository secret**" for each:

   | Secret Name | Value |
   |------------|-------|
   | `TENNIS_EMAIL` | `omorke@gmail.com` |
   | `TENNIS_PASSWORD` | `YOUR_PASSWORD_HERE` |
   | `TENNIS_PLAYERS` | `[{"lastName":"Moerke","firstName":"Oscar"},{"lastName":"Grabowski","firstName":"Bean"}]` |

   **IMPORTANT**: Copy the values exactly as shown above!

### Optional Secrets (can skip for now):
- `NTFY_ENABLE` - Set to `true` if you want notifications
- `NTFY_TOPIC` - Your ntfy topic name

## ✅ Verification Checklist

After setting up secrets:

1. Go to: https://github.com/Morkeeth/Booking/actions
2. You should see "Book Tennis Court" workflow
3. Click on it to verify it's enabled
4. Check that it's scheduled to run (you'll see "scheduled" in the workflow)

## 🧪 Test It Now (Optional but Recommended)

To test that everything works **before tomorrow**:

1. Go to: https://github.com/Morkeeth/Booking/actions
2. Click "**Book Tennis Court**"
3. Click "**Run workflow**" button
4. Select branch: `master`
5. Click "**Run workflow**"

⚠️ **WARNING**: This will attempt a REAL booking! Only do this if you want to test it NOW.

## 📅 What Will Happen Tomorrow

**October 23, 2025 at 8:00 AM CEST:**
- GitHub Actions will automatically run
- It will attempt to book for **Wednesday, October 29 at 8 PM**
- Priority: **Édouard Pailleron** → Candie → Poliveau
- Players: Oscar Moerke & Bean Grabowski

## 🔍 How to Check if It Ran

After 8 AM tomorrow:
1. Visit: https://github.com/Morkeeth/Booking/actions
2. Look for a run on October 23
3. Click on it to see:
   - ✅ Green checkmark = Success! Booking made
   - ❌ Red X = Failed, click to see error logs
   - 📸 Download "failure-screenshots" artifact if it failed

## 🆘 Troubleshooting

### "No secrets found" error:
- Double-check you added secrets in the correct location
- Secrets → Actions (not Dependabot or Codespaces)

### Workflow doesn't run:
- Verify Actions are enabled in repository settings
- GitHub may delay runs by a few minutes

### Booking fails:
- Check you have a valid "carnet de réservation"
- Verify your account has credit for the booking
- Download failure screenshots from Actions artifacts

## 📞 Quick Links

- **Repository**: https://github.com/Morkeeth/Booking
- **Actions**: https://github.com/Morkeeth/Booking/actions
- **Settings → Secrets**: https://github.com/Morkeeth/Booking/settings/secrets/actions

---

## Summary

**DO THIS NOW (takes 2 minutes):**
1. Go to https://github.com/Morkeeth/Booking/settings/secrets/actions
2. Add the 3 required secrets (TENNIS_EMAIL, TENNIS_PASSWORD, TENNIS_PLAYERS)
3. Verify Actions are enabled

**Your computer can be OFF tomorrow** - GitHub will handle it! 🎾

---
*Created: October 22, 2025, 11:59 PM*
*Next Run: October 23, 2025 at 8:00 AM CEST*

