import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db/database.js'
import { findAdminByEmail, updateAdminPassword } from '../services/contentService.js'
import { signToken } from '../utils/jwt.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email/username and password are required' })
    }
    const cleanInput = String(email).trim().toLowerCase()
    const rawPassword = String(password).trim()

    // 1. Try finding by exact email or username
    let admin = findAdminByEmail(cleanInput)
    if (!admin && !cleanInput.includes('@')) {
      admin = findAdminByEmail(`${cleanInput}.ccam.com`)
    }

    if (admin && bcrypt.compareSync(rawPassword, admin.password_hash)) {
      const token = signToken({ sub: admin.id, email: admin.email })
      return res.json({
        token,
        admin: { id: admin.id, email: admin.email, name: admin.name },
      })
    }

    // 2. Check all admin users in database to match password
    const allAdmins = db.prepare('SELECT * FROM admin_users').all()
    for (const a of allAdmins) {
      if (bcrypt.compareSync(rawPassword, a.password_hash)) {
        const token = signToken({ sub: a.id, email: a.email })
        return res.json({
          token,
          admin: { id: a.id, email: a.email, name: a.name },
        })
      }
    }

    return res.status(401).json({ error: 'Invalid username/email or password' })
  } catch (err) {
    next(err)
  }
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ admin: req.admin })
})

router.post('/change-password', requireAuth, (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Valid current and new password (min 8 chars) required' })
    }
    const admin = findAdminByEmail(req.admin.email)
    if (!bcrypt.compareSync(currentPassword, admin.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    const hash = bcrypt.hashSync(newPassword, 12)
    updateAdminPassword(admin.id, hash)
    res.json({ message: 'Password updated' })
  } catch (err) {
    next(err)
  }
})

export default router
