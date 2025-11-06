hag-proxy
=========
Proxy to accept Gateway KHOMP HTTPS (client cert) and forward to the main HAG server.

Deployment (Render):
1. Create a new Web Service on Render named 'hag-proxy'.
2. Upload this repository (via GitHub or manual deploy).
3. Add environment variable (optional):
   - TARGET_URL (default: https://hag-9umi.onrender.com/atualizar)
   - DISABLE_HTTPS=1 (if Render handles TLS; in that case the proxy will run HTTP)
4. Start the service. Render will provide HTTPS endpoint https://hag-proxy.onrender.com

Notes:
- If running on Render, TLS is usually terminated by Render. To accept client certificates, you would need to run HTTPS with certs directly — set DISABLE_HTTPS=0 and include cert.pem/key.pem. However Render terminates TLS itself, so client certificates may not reach your process.
- For most setups, configure Gateway to POST to https://hag-proxy.onrender.com/atualizar and let Render handle TLS.
