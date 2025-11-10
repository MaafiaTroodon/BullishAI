const http = require('http');
const { URL } = require('url');

const PORT = 8000;
const NEXTJS_API_URL = 'http://localhost:3000';

const server = http.createServer(async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // Forward the request to Next.js API
    const targetUrl = new URL(req.url, NEXTJS_API_URL);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: { ...req.headers, host: 'localhost:3000' }
    };

    // Remove host header to avoid issues
    delete options.headers.host;

    const proxyReq = http.request(options, (proxyRes) => {
      // Copy status code and headers
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // Pipe the response
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (error) => {
      console.error('Proxy error:', error);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to proxy request to Next.js API' }));
    });

    // Forward request body if present
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 API Proxy Server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying requests to ${NEXTJS_API_URL}/api`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('Server error:', error);
  }
});

