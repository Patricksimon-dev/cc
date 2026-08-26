import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3001,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  adminEmail: process.env.ADMIN_EMAIL || 'admin@gracechurch.org',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  publicSiteUrl: (process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, ''),
  apiPublicUrl: (process.env.API_PUBLIC_URL || 'https://christchosen.onrender.com').replace(/\/$/, ''),
  seedDefaultContent: process.env.SEED_DEFAULT_CONTENT === 'true',
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  mongoUri: process.env.MONGODB_URI,
  social: {
    facebook: {
      enabled: process.env.FACEBOOK_ENABLED === 'true',
      pageId: process.env.FACEBOOK_PAGE_ID || '',
      accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
    },
    instagram: {
      enabled: process.env.INSTAGRAM_ENABLED === 'true',
      businessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
      accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
    },
    twitter: {
      enabled: process.env.TWITTER_ENABLED === 'true',
      bearerToken: process.env.TWITTER_BEARER_TOKEN || '',
    },
    linkedin: {
      enabled: process.env.LINKEDIN_ENABLED === 'true',
      organizationId: process.env.LINKEDIN_ORGANIZATION_ID || '',
      accessToken: process.env.LINKEDIN_ACCESS_TOKEN || '',
    },
    tiktok: {
      enabled: process.env.TIKTOK_ENABLED === 'true',
      accessToken: process.env.TIKTOK_ACCESS_TOKEN || '',
    },
    youtube: {
      enabled: process.env.YOUTUBE_ENABLED === 'true',
      channelId: process.env.YOUTUBE_CHANNEL_ID || '',
      accessToken: process.env.YOUTUBE_ACCESS_TOKEN || '',
    },
    whatsapp: {
      enabled: process.env.WHATSAPP_ENABLED === 'true',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    },
  },
};

export const mailTransporter = nodemailer.createTransport({
  service: 'gmail', // adjust as needed
  auth: {
    user: config.emailUser,
    pass: config.emailPass,
  },
});

if (process.env.NODE_ENV === 'production') {
  for (const [name, value] of Object.entries({
    JWT_SECRET: process.env.JWT_SECRET,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    MONGODB_URI: process.env.MONGODB_URI,
  })) {
    if (!value || value.includes('change-this') || value === 'admin123') {
      throw new Error(`${name} must be configured in production`)
    }
  }
}

if (config.mongoUri) {
  console.info('MongoDB content persistence is enabled.');
}