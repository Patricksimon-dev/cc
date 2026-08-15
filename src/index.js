import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import { initDb } from './db/database.js'
import './db/seed.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import socialRoutes from './routes/social.js'
import contactRoutes from './routes/contact.js'
import { errorHandler } from './middleware/errorHandler.js'
import { getPublicContent } from './services/contentService.js'

initDb()

const app = express()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

app.use(helmet({ contentSecurityPolicy: false }))
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
)
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ limit: '100mb', extended: true }))
app.use('/api/uploads', express.static(uploadsDir))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many login attempts, try again later' },
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

app.get('/api/content', (req, res) => {
  res.json(getPublicContent())
})

app.use('/api', contactRoutes)
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/social', socialRoutes)

app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`Church API running on http://localhost:${config.port}`)
})
