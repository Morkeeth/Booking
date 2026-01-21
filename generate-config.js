import { writeFileSync } from 'fs'

/**
 * Generate config.json from environment variables
 * This is used by GitHub Actions to create config from secrets
 */

const config = {
  account: {
    email: process.env.TENNIS_EMAIL || 'user.name@host.com',
    password: process.env.TENNIS_PASSWORD || '12345'
  },
  locations: process.env.TENNIS_LOCATIONS 
    ? JSON.parse(process.env.TENNIS_LOCATIONS)
    : [
        "Tennis Edouard Pailleron",
        "Poliveau",
        "Tennis Candie",
        "Tennis Broquedis - Asnières"
      ],
  // date is optional - if not set, will book 6 days in advance
  ...(process.env.TENNIS_DATE && { date: process.env.TENNIS_DATE }),
  hours: process.env.TENNIS_HOURS
    ? JSON.parse(process.env.TENNIS_HOURS)
    : ["21", "20", "19", "18", "17", "16", "15", "14", "13", "12", "11", "10", "09", "08"],
  priceType: process.env.TENNIS_PRICE_TYPE
    ? JSON.parse(process.env.TENNIS_PRICE_TYPE)
    : ["Tarif plein", "Tarif réduit"],
  courtType: process.env.TENNIS_COURT_TYPE
    ? JSON.parse(process.env.TENNIS_COURT_TYPE)
    : ["Découvert", "Couvert"],
  players: process.env.TENNIS_PLAYERS
    ? JSON.parse(process.env.TENNIS_PLAYERS)
    : [
        {
          lastName: "Moerke",
          firstName: "Oscar"
        },
        {
          lastName: "Grabowski",
          firstName: "Bean"
        }
      ],
  ntfy: {
    enable: process.env.NTFY_ENABLE === 'true' || false,
    topic: process.env.NTFY_TOPIC || "YOUR-OWN-TOPIC"
  },
  ai: {
    space: "FatBoyEnglish/Text_Captcha_breaker"
  }
}

writeFileSync('config.json', JSON.stringify(config, null, 2))
console.log('config.json generated successfully')

