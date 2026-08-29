import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/sqlitePersistence.js'
import { mailTransporter, config } from '../config.js'

const router = Router()

router.post('/contact', async (req, res, next) => {
  const { name, email, subject, message } = req.body

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  try {
    const id = uuidv4()
    const db = getDb()
    const stmt = db.prepare(`
      INSERT INTO contact_messages (id, name, email, subject, message)
      VALUES (?, ?, ?, ?, ?)
    `)
    stmt.run(id, name.trim(), email.trim(), subject.trim(), message.trim())

    const isEmailConfigured =
      config.emailUser &&
      config.emailPass &&
      config.emailUser !== 'your_smtp_user@example.com' &&
      !config.emailUser.includes('example.com')

    if (isEmailConfigured) {
      const mailOptions = {
        from: config.emailUser,
        to: 'christchosenassemblymin@gmail.com',
        subject: `Contact Form: ${subject}`,
        text: `From: ${name} <${email}>\n\n${message}`,
      }

      try {
        await mailTransporter.sendMail(mailOptions)
        console.log(`Contact message sent successfully to christchosenassemblymin@gmail.com`)
      } catch (mailErr) {
        console.warn('Contact message saved to database, but email delivery failed:', mailErr.message)
      }
    } else {
      console.warn('Email transport not fully configured with valid credentials; contact message saved to database only.')
    }

    res.status(201).json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
