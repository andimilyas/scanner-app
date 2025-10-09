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
  key: fs.readFileSync('/etc/ssl/certs/_.rsudpasarrebo.id.key'), // PAKAI SSL YANG VALID
  cert: fs.readFileSync('/etc/ssl/certs/_.rsudpasarrebo.id.crt'), // PAKAI SSL YANG VALID
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    
    // SET HEADER YANG BENAR - gabung semua dalam satu line
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
    res.setHeader('Feature-Policy', 'camera self');
    
    handle(req, res, parsedUrl);
  }).listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on https://${hostname}:${port}`);
  });
});