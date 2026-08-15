import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getItemByType } from '../services/contentService.js'
import {
  getSocialPlatformStatus,
  publishToSocial,
} from '../services/socialPublisher.js'
import { getSocialLogs } from '../services/contentService.js'

const router = Router()
router.use(requireAuth)

router.get('/status', (req, res) => {
  res.json(getSocialPlatformStatus())
})

router.get('/logs', (req, res) => {
  res.json(getSocialLogs(100))
})

router.post('/publish', async (req, res, next) => {
  try {
    const { contentType, contentId, platforms, customMessage } = req.body
    if (!contentType || !contentId || !platforms?.length) {
      return res.status(400).json({ error: 'contentType, contentId, and platforms are required' })
    }
    const item = getItemByType(contentType, contentId)
    if (!item) return res.status(404).json({ error: 'Content not found' })
    const results = await publishToSocial({
      contentType,
      contentId,
      item,
      platforms,
      customMessage,
    })
    res.json({ results })
  } catch (err) {
    next(err)
  }
})

export default router
