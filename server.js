import express from 'express'
import { bookTennis } from './index.js'

// Import config to ensure it's loaded
import './staticFiles.js'

const app = express()
const PORT = process.env.PORT || 3000
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

// Middleware to check webhook secret (if configured)
const checkWebhookAuth = (req, res, next) => {
  if (!WEBHOOK_SECRET) {
    // No secret configured, allow all requests
    return next()
  }
  
  // Check for secret in query param or header
  const providedSecret = req.query.secret || req.headers['x-webhook-secret']
  
  if (providedSecret === WEBHOOK_SECRET) {
    return next()
  }
  
  return res.status(401).json({ error: 'Unauthorized' })
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Booking trigger endpoint (with optional auth)
app.post('/book', checkWebhookAuth, async (req, res) => {
  console.log('Booking triggered via HTTP POST endpoint')
  res.json({ status: 'triggered', message: 'Booking process started' })
  
  // Run booking in background
  bookTennis(0).catch(err => {
    console.error('Booking error:', err)
  })
})

// GET endpoint for easy cron triggering (with optional auth)
app.get('/book', checkWebhookAuth, async (req, res) => {
  console.log('Booking triggered via GET endpoint')
  res.json({ status: 'triggered', message: 'Booking process started' })
  
  // Run booking in background
  bookTennis(0).catch(err => {
    console.error('Booking error:', err)
  })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  console.log(`Trigger booking: http://localhost:${PORT}/book`)
})
