// Proxy to forward Gateway requests to main HAG server
import fs from 'fs';
import http from 'http';
import https from 'https';
import express from 'express';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(express.json({ limit: '20mb', type: () => true }));
app.use(express.text({ limit: '20mb', type: '*/*' }));

// Target HAG server (Render)
const TARGET = process.env.TARGET_URL || 'https://hag-9umi.onrender.com/atualizar';

// Try multiple backend ports (if routing to localhost)
const BACKEND_PORTS = [10000, 3000, 8080, 5000];

async function forwardToTarget(data) {
  try {
    const resp = await axios.post(TARGET, data, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
    return resp.data;
  } catch (err) {
    throw err;
  }
}

app.post('/atualizar', async (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { /* keep as string */ }
  }
  try {
    const forwarded = await forwardToTarget(body);
    console.log('Forwarded to target:', forwarded);
    res.json({ success: true, proxied: true, target: forwarded });
  } catch (err) {
    console.error('Error forwarding to target:', err.message || err);
    res.status(502).json({ error: 'failed to forward', detail: String(err.message || err) });
  }
});

// health
app.get('/', (req, res) => res.send('hag-proxy ok'));

const PORT = process.env.PORT || 443;
const certPath = path.join(process.cwd(), 'cert.pem');
const keyPath = path.join(process.cwd(), 'key.pem');
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath) && process.env.DISABLE_HTTPS !== '1';

if (useHttps) {
  const options = { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
  https.createServer(options, app).listen(PORT, () => console.log(`HTTPS proxy listening on ${PORT}`));
} else {
  http.createServer(app).listen(PORT, () => console.log(`HTTP proxy listening on ${PORT}`));
}
