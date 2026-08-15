import { verifyToken } from '../utils/jwt.js'
import { findAdminById } from '../services/contentService.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  try {
    const decoded = verifyToken(header.slice(7))
    const admin = findAdminById(decoded.sub)
    if (!admin) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    req.admin = admin
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
