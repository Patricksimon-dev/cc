import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import db, { initDb } from './database.js'
import { config } from '../config.js'

const seedData = {
  announcements: [
    {
      title: 'Welcome to Our Church Family',
      content:
        'We are delighted to welcome all visitors this Sunday. Join us for worship at 10:00 AM.',
      date: '2026-07-13',
      pinned: 1,
    },
    {
      title: 'Youth Ministry Registration Open',
      content:
        'Registration for the fall youth program is now open. Sign up at the welcome desk after service.',
      date: '2026-07-10',
      pinned: 0,
    },
  ],
  sermons: [
    {
      title: 'Walking in Faith',
      preacher: 'Pastor John Smith',
      date: '2026-07-13',
      scripture: 'Hebrews 11:1',
      summary: 'An inspiring message about trusting God through every season of life.',
      video_url: '',
      audio_url: '',
    },
    {
      title: 'The Power of Prayer',
      preacher: 'Pastor John Smith',
      date: '2026-07-06',
      scripture: 'James 5:16',
      summary: 'Discover how consistent prayer transforms our hearts and communities.',
      video_url: '',
      audio_url: '',
    },
  ],
  activities: [
    {
      title: 'Sunday Worship Service',
      day: 'Sunday',
      time: '10:00 AM',
      location: 'Main Sanctuary',
      description: 'Weekly worship with praise, prayer, and the Word.',
    },
    {
      title: 'Bible Study',
      day: 'Wednesday',
      time: '7:00 PM',
      location: 'Fellowship Hall',
      description: 'Mid-week Bible study for all ages.',
    },
    {
      title: 'Youth Group',
      day: 'Friday',
      time: '6:30 PM',
      location: 'Youth Center',
      description: 'Games, worship, and fellowship for teens.',
    },
  ],
  events: [
    {
      title: 'Community Outreach Day',
      date: '2026-07-26',
      time: '9:00 AM',
      location: 'Church Grounds',
      description: 'Join us as we serve our neighbors with food, clothing, and prayer.',
      image_url: '',
    },
    {
      title: 'Annual Church Picnic',
      date: '2026-08-15',
      time: '12:00 PM',
      location: 'Riverside Park',
      description: 'Food, games, and fellowship for the whole family.',
      image_url: '',
    },
  ],
  leadership: [
    {
      name: 'Pastor John Smith',
      role: 'Senior Pastor',
      bio: 'Pastor John has served Grace Community Church for over 15 years. He holds a Master of Divinity and is passionate about expository preaching and community outreach.',
      image_url: '',
    },
    {
      name: 'Mary Johnson',
      role: 'Worship Leader',
      bio: 'Mary leads our worship team with a heart for authentic praise. She has been involved in music ministry for 20 years and trains new musicians each season.',
      image_url: '',
    },
    {
      name: 'David Williams',
      role: 'Youth Pastor',
      bio: 'David mentors teens and young adults, building programs that combine fun, faith, and fellowship. He joined our staff in 2019.',
      image_url: '',
    },
    {
      name: 'Sarah Chen',
      role: 'Church Administrator',
      bio: 'Sarah oversees day-to-day operations and coordinates our deacon board. She has been a member since 2005 and served on leadership since 2012.',
      image_url: '',
    },
  ],
  about: {
    welcome_title: 'Who We Are',
    welcome_text:
      'Grace Community Church is a welcoming congregation dedicated to knowing Christ and making Him known. Since 1985, we have been a spiritual home for families, singles, and seekers from all walks of life.',
    mission:
      'To lead people into a growing relationship with Jesus Christ through worship, discipleship, and service.',
    vision:
      "A thriving community where every person experiences God's grace and shares it with the world.",
    history:
      'Founded in 1985 by a small group of believers, Grace Community Church began meeting in a local school gymnasium. Through faithful giving and prayer, we built our current sanctuary in 1998. Today we serve hundreds of families and partner with ministries locally and abroad.',
    values_text: 'Worship · Fellowship · Discipleship · Service · Prayer',
  },
}

function seedIfEmpty() {
  initDb()

  const targetEmail = (config.adminEmail || 'idokoekeleadmin.ccam.com').trim().toLowerCase()
  const targetPassword = config.adminPassword || '890idoko'
  const hash = bcrypt.hashSync(targetPassword, 12)

  const existingAdmin = db.prepare('SELECT * FROM admin_users WHERE lower(email) = ?').get(targetEmail)
  if (!existingAdmin) {
    db.prepare(
      'INSERT INTO admin_users (id, email, password_hash, name) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), targetEmail, hash, 'Church Admin')
    console.log(`Admin user created/synced: ${targetEmail}`)
  } else {
    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(hash, existingAdmin.id)
    console.log(`Admin user password updated for: ${targetEmail}`)
  }

  const annCount = db.prepare('SELECT COUNT(*) AS c FROM announcements').get().c
  if (annCount === 0) {
    const insertAnn = db.prepare(
      'INSERT INTO announcements (id, title, content, date, pinned) VALUES (?, ?, ?, ?, ?)'
    )
    for (const row of seedData.announcements) {
      insertAnn.run(uuidv4(), row.title, row.content, row.date, row.pinned)
    }
  }

  const sermonCount = db.prepare('SELECT COUNT(*) AS c FROM sermons').get().c
  if (sermonCount === 0) {
    const insert = db.prepare(
      `INSERT INTO sermons (id, title, preacher, date, scripture, summary, video_url, audio_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const row of seedData.sermons) {
      insert.run(
        uuidv4(),
        row.title,
        row.preacher,
        row.date,
        row.scripture,
        row.summary,
        row.video_url,
        row.audio_url
      )
    }
  }

  const actCount = db.prepare('SELECT COUNT(*) AS c FROM activities').get().c
  if (actCount === 0) {
    const insert = db.prepare(
      'INSERT INTO activities (id, title, day, time, location, description) VALUES (?, ?, ?, ?, ?, ?)'
    )
    for (const row of seedData.activities) {
      insert.run(uuidv4(), row.title, row.day, row.time, row.location, row.description)
    }
  }

  const evCount = db.prepare('SELECT COUNT(*) AS c FROM events').get().c
  if (evCount === 0) {
    const insert = db.prepare(
      'INSERT INTO events (id, title, date, time, location, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    for (const row of seedData.events) {
      insert.run(
        uuidv4(),
        row.title,
        row.date,
        row.time,
        row.location,
        row.description,
        row.image_url
      )
    }
  }

  const leadCount = db.prepare('SELECT COUNT(*) AS c FROM leadership').get().c
  if (leadCount === 0) {
    const insert = db.prepare(
      'INSERT INTO leadership (id, name, role, bio, image_url) VALUES (?, ?, ?, ?, ?)'
    )
    for (const row of seedData.leadership) {
      insert.run(uuidv4(), row.name, row.role, row.bio, row.image_url)
    }
  }

  const aboutCount = db.prepare('SELECT COUNT(*) AS c FROM about_page').get().c
  if (aboutCount === 0) {
    const a = seedData.about
    db.prepare(
      `INSERT INTO about_page (id, welcome_title, welcome_text, mission, vision, history, values_text)
       VALUES (1, ?, ?, ?, ?, ?, ?)`
    ).run(a.welcome_title, a.welcome_text, a.mission, a.vision, a.history, a.values_text)
  }
}

seedIfEmpty()
console.log('Database ready.')
