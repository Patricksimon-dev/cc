const path = require('path');
const fs = require('fs');
const server = require('../server');

const app = server.app;

app.get('/', (_req, res) => {
  const indexPath = path.join(__dirname, '..', 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  return res.status(404).send('index.html not found');
});

module.exports = app;
