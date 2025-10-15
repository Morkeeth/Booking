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
    : ["Valeyre", "Suzanne Lenglen", "Poliveau"],
  // date is optional - if not set, will book 6 days in advance
  // date: "9/10/2021",
  hours: process.env.TENNIS_HOURS
    ? JSON.parse(process.env.TENNIS_HOURS)
    : ["14", "15", "16", "10", "11"],
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
          lastName: "Lastname1",
          firstName: "Firstname1"
        },
        {
          lastName: "Lastname2",
          firstName: "Firstname2"
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

