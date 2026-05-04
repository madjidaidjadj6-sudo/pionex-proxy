const https = require('https');
const http = require('http');
const url = require('url');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // CORS headers — allow all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', time: Date.now() }));
    return;
  }

  // Proxy all /api/* requests to Pionex
  const parsedUrl = url.parse(req.url);
  const path = parsedUrl.path; // e.g. /api/v1/account/balances?...

  if (!path.startsWith('/api/')) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Collect request body
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const options = {
      hostname: 'api.pionex.com',
      port: 443,
      path: path,
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      }
    };

    // Forward important headers
    if (req.headers['x-pionex-key']) {
      options.headers['X-PIONEX-KEY'] = req.headers['x-pionex-key'];
    }

    const proxyReq = https.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result: false, message: e.message }));
    });

    if (body) proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`Pionex Proxy running on port ${PORT}`);
});
