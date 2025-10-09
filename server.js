/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

const dev = false;
const hostname = '10.0.10.12';
const port = 5002;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('/etc/ssl/certs/_.rsudpasarrebo.id.key'), 
  cert: fs.readFileSync('/etc/ssl/certs/_.rsudpasarrebo.id.crt'), 
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);

    // Set security headers
    res.setHeader(
      'Permissions-Policy',
      'camera=(self "https://10.0.10.12:5002"); microphone=(); geolocation=()'
    );
    
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");

    handle(req, res, parsedUrl);
  }).listen(port, hostname, (err) => {
    if (err) {
      console.error('Server startup error:', err);
      process.exit(1);
    }
    console.log(`> Ready on https://${hostname}:${port}`);
  });
});