async function run() {
  try {
    const imgUrl = 'http://localhost:5173/go-pastor.jpg'
    const loginUrl = 'http://localhost:3001/api/auth/login'

    const imgRes = await fetch(imgUrl, { method: 'HEAD' })
    console.log('IMAGE_STATUS', imgRes.status)

    const loginRes = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@gracechurch.org', password: 'admin123' }),
    })
    const loginBody = await loginRes.text()
    console.log('LOGIN_STATUS', loginRes.status)
    console.log('LOGIN_BODY', loginBody)
  } catch (err) {
    console.error('ERROR', err.stack || err.message || err)
    process.exit(1)
  }
}

run()
