'use strict';

const http = require('http');
const { getSupabaseClient } = require('./ipc/supabase.ipc');

const ALLOWED_EMAILS = [
  'kayastha.noor1100@gmail.com',
  'niroj.mahrjan@gmail.com',
];

let authServer = null;

/**
 * Starts a temporary local HTTP loopback server on port 54321 to handle OAuth callback.
 * Resolves with { accessToken, refreshToken, code } or rejects on timeout.
 * @returns {Promise<{accessToken: string, refreshToken: string, code: string}>}
 */
function startAuthServer() {
  return new Promise((resolve, reject) => {
    // If a server is already running, close it
    if (authServer) {
      try {
        authServer.close();
      } catch (e) {
        console.error('[auth] Error closing existing auth server:', e.message);
      }
    }

    const timeout = setTimeout(() => {
      if (authServer) {
        authServer.close();
        authServer = null;
        reject(new Error('Authentication timed out. Please try again.'));
      }
    }, 5 * 60 * 1000); // 5 minutes timeout

    authServer = http.createServer((req, res) => {
      // Handle favicon requests quietly
      if (req.url === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url, 'http://localhost:54321');

      if (url.pathname === '/callback') {
        // Serve a beautiful dark-themed callback page
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>CommandCenter Authentication</title>
            <meta charset="utf-8">
            <style>
              body {
                background-color: #0e0e10;
                color: #e8e6f0;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
              }
              .card {
                background: #16161a;
                border: 1px solid rgba(255, 255, 255, 0.08);
                padding: 3rem;
                border-radius: 12px;
                text-align: center;
                max-width: 400px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
              }
              h1 {
                font-size: 1.5rem;
                margin-top: 0;
                margin-bottom: 12px;
                background: linear-gradient(135deg, #5b6af8, #9d8ff5);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
              }
              p {
                color: #8a8799;
                font-size: 0.9rem;
                margin-bottom: 0;
                line-height: 1.5;
              }
              .loader {
                width: 24px;
                height: 24px;
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-top: 2px solid #5b6af8;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 20px auto 0 auto;
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1 id="status-title">Authenticating...</h1>
              <p id="status-text">Connecting to CommandCenter. You will be redirected shortly.</p>
              <div id="loader" class="loader"></div>
            </div>
            <script>
              const query = window.location.search;
              const hash = window.location.hash;
              let url = '/token' + query;
              if (hash) {
                url += (query ? '&' : '?') + 'hash=' + encodeURIComponent(hash);
              }

              fetch(url)
                .then(r => {
                  if (!r.ok) {
                    return r.json().then(data => {
                      throw new Error(data.error || 'Server error');
                    });
                  }
                  return r.json();
                })
                .then((data) => {
                  if (data.error) throw new Error(data.error);
                  document.getElementById('status-title').textContent = 'Authenticated!';
                  document.getElementById('status-title').style.background = 'linear-gradient(135deg, #3ecf8e, #5b6af8)';
                  document.getElementById('status-title').style.webkitBackgroundClip = 'text';
                  document.getElementById('status-text').textContent = 'You are successfully logged in. You can close this browser tab and return to CommandCenter.';
                  document.getElementById('loader').style.display = 'none';
                })
                .catch((err) => {
                  document.getElementById('status-title').textContent = 'Access Denied';
                  document.getElementById('status-title').style.background = 'linear-gradient(135deg, #e85d4a, #f5a623)';
                  document.getElementById('status-title').style.webkitBackgroundClip = 'text';
                  document.getElementById('status-text').textContent = err.message;
                  document.getElementById('loader').style.display = 'none';
                });
            </script>
          </body>
          </html>
        `);
      } else if (url.pathname === '/token') {
        // Retrieve parameters from search parameters
        let accessToken = url.searchParams.get('access_token');
        let refreshToken = url.searchParams.get('refresh_token');

        // Extract parameters from the hash parameter sent by client script
        const hashStr = url.searchParams.get('hash');
        if (hashStr) {
          const hashParams = new URLSearchParams(hashStr.replace(/^#/, ''));
          accessToken = accessToken || hashParams.get('access_token');
          refreshToken = refreshToken || hashParams.get('refresh_token');
        }

        const code = url.searchParams.get('code');

        // Main process allowlist validation
        (async () => {
          try {
            if (!accessToken) {
              throw new Error('Missing access token.');
            }

            const supabaseClient = getSupabaseClient();
            const { data: { user }, error: userError } = await supabaseClient.auth.getUser(accessToken);

            if (userError || !user) {
              throw new Error(userError?.message || 'Failed to authenticate user profile.');
            }

            if (!ALLOWED_EMAILS.includes(user.email)) {
              throw new Error(`Your email (${user.email}) is not in the allowed list of CommandCenter workspace developers.`);
            }

            // Successfully authenticated and authorized
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify({ success: true }));

            clearTimeout(timeout);
            resolve({ accessToken, refreshToken, code });
          } catch (err) {
            console.error('[auth] Validation failed:', err.message);
            res.writeHead(403, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify({ success: false, error: err.message }));

            clearTimeout(timeout);
            reject(err);
          } finally {
            // Close server after a short delay to allow response to finish cleanly
            setTimeout(() => {
              if (authServer) {
                authServer.close();
                authServer = null;
              }
            }, 1000);
          }
        })();
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    authServer.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    authServer.listen(54321, '127.0.0.1');
  });
}

module.exports = { startAuthServer };
