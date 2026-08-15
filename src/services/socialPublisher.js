import { config } from '../config.js'
import { logSocialPublish } from './contentService.js'
import { v4 as uuidv4 } from 'uuid'

const SHAREABLE_TYPES = new Set(['announcements', 'sermons', 'events'])
const AVAILABLE_PLATFORMS = new Set([
  'facebook',
  'instagram',
  'twitter',
  'linkedin',
  'tiktok',
  'youtube',
  'whatsapp',
])

export function buildSocialMessage(contentType, item, customMessage) {
  if (customMessage?.trim()) return customMessage.trim()

  const site = config.publicSiteUrl
  switch (contentType) {
    case 'announcements':
      return `${item.title}\n\n${item.content}\n\n${site}/announcements`
    case 'sermons':
      return `New sermon: ${item.title} — ${item.preacher}${item.scripture ? ` (${item.scripture})` : ''}\n\n${item.summary}\n\n${site}/sermons`
    case 'events':
      return `Upcoming event: ${item.title} — ${item.date} at ${item.time}, ${item.location}\n\n${item.description}\n\n${site}/events`
    default:
      return `${item.title || 'Update from Grace Community Church'}\n\n${site}`
  }
}

async function postToFacebook(message, link) {
  const { pageId, accessToken } = config.social.facebook
  const url = `https://graph.facebook.com/v21.0/${pageId}/feed`
  const body = new URLSearchParams({
    message,
    access_token: accessToken,
  })
  if (link) body.set('link', link)

  const res = await fetch(url, { method: 'POST', body })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error?.message || 'Facebook API error')
  }
  return data.id
}

async function postToTwitter(message) {
  const text = message.length > 280 ? `${message.slice(0, 277)}...` : message
  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.social.twitter.bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.detail || data.title || 'Twitter API error')
  }
  return data.data?.id
}

async function postToLinkedIn(message, link) {
  const url = `https://api.linkedin.com/v2/ugcPosts`
  const body = {
    author: `urn:li:organization:${config.social.linkedin.organizationId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: message },
        shareMediaCategory: link ? 'ARTICLE' : 'NONE',
        media: link ? [{ status: 'READY', originalUrl: link }] : undefined,
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.social.linkedin.accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'LinkedIn API error')
  }
  return data.id
}

async function postToTikTok(message) {
  throw new Error('TikTok publishing requires a configured TikTok API workflow. Set TIKTOK_ACCESS_TOKEN in server/.env to enable it.')
}

async function postToYouTube(message) {
  throw new Error('YouTube publishing requires a configured YouTube Data API workflow. Set YOUTUBE_ACCESS_TOKEN in server/.env to enable it.')
}

async function postToWhatsApp(message) {
  throw new Error('WhatsApp publishing requires a configured Meta Cloud API workflow. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in server/.env to enable it.')
}

export function getSocialPlatformStatus() {
  const fb = config.social.facebook
  const ig = config.social.instagram
  const tw = config.social.twitter
  const li = config.social.linkedin
  const tt = config.social.tiktok
  const yt = config.social.youtube
  const wa = config.social.whatsapp
  return {
    facebook: {
      enabled: fb.enabled,
      configured: Boolean(fb.pageId && fb.accessToken),
    },
    instagram: {
      enabled: ig.enabled,
      configured: Boolean(ig.businessAccountId && ig.accessToken),
    },
    twitter: {
      enabled: tw.enabled,
      configured: Boolean(tw.bearerToken),
    },
    linkedin: {
      enabled: li.enabled,
      configured: Boolean(li.organizationId && li.accessToken),
    },
    tiktok: {
      enabled: tt.enabled,
      configured: Boolean(tt.accessToken),
    },
    youtube: {
      enabled: yt.enabled,
      configured: Boolean(yt.channelId && yt.accessToken),
    },
    whatsapp: {
      enabled: wa.enabled,
      configured: Boolean(wa.phoneNumberId && wa.accessToken),
    },
  }
}

export async function publishToSocial({ contentType, contentId, item, platforms, customMessage }) {
  if (!SHAREABLE_TYPES.has(contentType)) {
    throw new Error('This content type cannot be shared to social media')
  }

  const invalidPlatform = platforms.find((platform) => !AVAILABLE_PLATFORMS.has(platform))
  if (invalidPlatform) {
    throw new Error(`Unknown platform: ${invalidPlatform}`)
  }

  const message = buildSocialMessage(contentType, item, customMessage)
  const link = `${config.publicSiteUrl}/${contentType === 'sermons' ? 'sermons' : contentType === 'events' ? 'events' : 'announcements'}`
  const results = []

  for (const platform of platforms) {
    const logId = uuidv4()
    try {
      if (platform === 'facebook') {
        if (!config.social.facebook.enabled || !config.social.facebook.pageId) {
          throw new Error('Facebook is not configured. Set FACEBOOK_* in server/.env')
        }
        const externalId = await postToFacebook(message, link)
        logSocialPublish({
          id: logId,
          contentType,
          contentId,
          platform: 'facebook',
          status: 'success',
          externalId,
          message,
        })
        results.push({ platform, status: 'success', externalId })
      } else if (platform === 'instagram') {
        if (!config.social.instagram.enabled || !config.social.instagram.businessAccountId) {
          throw new Error('Instagram is not configured. Set INSTAGRAM_ENABLED=true and INSTAGRAM_* in server/.env')
        }
        const externalId = await postToFacebook(message, link)
        logSocialPublish({
          id: logId,
          contentType,
          contentId,
          platform: 'instagram',
          status: 'success',
          externalId,
          message,
        })
        results.push({ platform, status: 'success', externalId })
      } else if (platform === 'twitter') {
        if (!config.social.twitter.enabled || !config.social.twitter.bearerToken) {
          throw new Error('Twitter/X is not configured. Set TWITTER_* in server/.env')
        }
        const externalId = await postToTwitter(message)
        logSocialPublish({
          id: logId,
          contentType,
          contentId,
          platform: 'twitter',
          status: 'success',
          externalId,
          message,
        })
        results.push({ platform, status: 'success', externalId })
      } else if (platform === 'linkedin') {
        if (!config.social.linkedin.enabled || !config.social.linkedin.organizationId) {
          throw new Error('LinkedIn is not configured. Set LINKEDIN_ENABLED=true and LINKEDIN_* in server/.env')
        }
        const externalId = await postToLinkedIn(message, link)
        logSocialPublish({
          id: logId,
          contentType,
          contentId,
          platform: 'linkedin',
          status: 'success',
          externalId,
          message,
        })
        results.push({ platform, status: 'success', externalId })
      } else if (platform === 'tiktok') {
        await postToTikTok(message)
        logSocialPublish({
          id: logId,
          contentType,
          contentId,
          platform: 'tiktok',
          status: 'success',
          message,
        })
        results.push({ platform, status: 'success' })
      } else if (platform === 'youtube') {
        await postToYouTube(message)
        logSocialPublish({
          id: logId,
          contentType,
          contentId,
          platform: 'youtube',
          status: 'success',
          message,
        })
        results.push({ platform, status: 'success' })
      } else if (platform === 'whatsapp') {
        await postToWhatsApp(message)
        logSocialPublish({
          id: logId,
          contentType,
          contentId,
          platform: 'whatsapp',
          status: 'success',
          message,
        })
        results.push({ platform, status: 'success' })
      } else {
        throw new Error(`Unknown platform: ${platform}`)
      }
    } catch (err) {
      logSocialPublish({
        id: logId,
        contentType,
        contentId,
        platform,
        status: 'failed',
        message,
        error: err.message,
      })
      results.push({ platform, status: 'failed', error: err.message })
    }
  }

  return results
}
