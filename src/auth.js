/**
 * OAuth 2.0 Authorization Code flow for Help Scout Mailbox API v2.
 * Starts a local HTTP server on port 9753 to capture the redirect.
 * Token cache: ~/.cache/helpscout/token.json
 */
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CALLBACK_PORT = 9753;
const CALLBACK_PATH = '/callback';
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}${CALLBACK_PATH}`;
const AUTH_URL = 'https://secure.helpscout.net/authentication/authorizeClientApplication';
const TOKEN_URL = 'https://api.helpscout.net/v2/oauth2/token';
const TOKEN_CACHE_DIR = path.join(os.homedir(), '.cache', 'helpscout');
const TOKEN_CACHE_FILE = path.join(TOKEN_CACHE_DIR, 'token.json');

// Tokens are valid for 48h; refresh 5 min early
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

function getCredentials() {
  const appId = process.env.HELPSCOUT_APP_ID;
  const appSecret = process.env.HELPSCOUT_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('HELPSCOUT_APP_ID and HELPSCOUT_APP_SECRET environment variables are not set.');
  }
  return { appId, appSecret };
}

async function readTokenCache() {
  try {
    const raw = await readFile(TOKEN_CACHE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeTokenCache(token) {
  if (!existsSync(TOKEN_CACHE_DIR)) {
    await mkdir(TOKEN_CACHE_DIR, { recursive: true });
  }
  await writeFile(TOKEN_CACHE_FILE, JSON.stringify(token, null, 2), 'utf8');
}

async function exchangeCode(code, appId, appSecret) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: appId,
    client_secret: appSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 172800) * 1000,
  };
}

async function refreshAccessToken(refreshToken, appId, appSecret) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: appId,
    client_secret: appSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status})`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + (data.expires_in ?? 172800) * 1000,
  };
}

/**
 * Force a token refresh regardless of expiry. Used when the API returns 401.
 */
export async function forceRefreshToken() {
  const cached = await readTokenCache();
  if (!cached?.refresh_token) {
    throw new Error('Not authenticated. Run: helpscout auth login');
  }
  const { appId, appSecret } = getCredentials();
  try {
    const refreshed = await refreshAccessToken(cached.refresh_token, appId, appSecret);
    await writeTokenCache(refreshed);
    return refreshed.access_token;
  } catch {
    throw new Error('Session expired. Run: helpscout auth login');
  }
}

/**
 * Returns a valid access token, refreshing silently if needed.
 * Throws if no cached token exists (user must run `helpscout auth login`).
 */
export async function getAccessToken() {
  const cached = await readTokenCache();
  if (!cached) {
    throw new Error('Not authenticated. Run: helpscout auth login');
  }

  if (Date.now() < cached.expires_at - EXPIRY_BUFFER_MS) {
    return cached.access_token;
  }

  // Token expired or about to — try silent refresh
  const { appId, appSecret } = getCredentials();
  try {
    const refreshed = await refreshAccessToken(cached.refresh_token, appId, appSecret);
    await writeTokenCache(refreshed);
    return refreshed.access_token;
  } catch {
    // Refresh failed — ask user to re-authenticate
    throw new Error('Session expired. Run: helpscout auth login');
  }
}

/**
 * Opens the given URL in the default browser without shell interpolation.
 */
function openBrowser(url) {
  const platform = process.platform;
  if (platform === 'darwin') {
    execFile('open', [url]);
  } else if (platform === 'win32') {
    execFile('cmd', ['/c', 'start', url]);
  } else {
    execFile('xdg-open', [url]);
  }
}

/**
 * Full OAuth Authorization Code flow.
 * Opens the browser and waits for the callback on localhost:9753.
 */
export async function login() {
  const { appId, appSecret } = getCredentials();

  // State param for CSRF protection
  const state = randomBytes(16).toString('hex');

  const authParams = new URLSearchParams({
    client_id: appId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    state,
  });

  const authorizationUrl = `${AUTH_URL}?${authParams.toString()}`;

  // Start local callback server before opening the browser
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
      if (url.pathname !== CALLBACK_PATH) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const returnedState = url.searchParams.get('state');
      const returnedCode = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      const html = (msg) =>
        `<!doctype html><html><body style="font-family:sans-serif;padding:2rem"><h2>${msg}</h2><p>You can close this tab.</p></body></html>`;

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(html(`Authorization failed: ${error}`));
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(html('State mismatch — possible CSRF. Please try again.'));
        server.close();
        reject(new Error('State mismatch'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html('Authenticated successfully! You can close this tab.'));
      server.close();
      resolve(returnedCode);
    });

    server.on('error', (err) => reject(err));
    server.listen(CALLBACK_PORT, '127.0.0.1');

    process.stderr.write(
      `\nOpening browser for Help Scout authentication...\nIf it doesn't open, visit:\n${authorizationUrl}\n\n`,
    );
    openBrowser(authorizationUrl);
  });

  const token = await exchangeCode(code, appId, appSecret);
  await writeTokenCache(token);
  return { ok: true, message: 'Authenticated successfully. Token cached.' };
}

/**
 * Remove the cached token (logout).
 */
export async function logout() {
  const { unlink } = await import('node:fs/promises');
  try {
    await unlink(TOKEN_CACHE_FILE);
    return { ok: true, message: 'Logged out. Token removed.' };
  } catch {
    return { ok: true, message: 'No cached token found.' };
  }
}

/**
 * Return token status without revealing the token value.
 */
export async function status() {
  const cached = await readTokenCache();
  if (!cached) {
    return { authenticated: false, message: 'Not authenticated.' };
  }
  const expiresIn = Math.round((cached.expires_at - Date.now()) / 1000 / 60);
  if (expiresIn <= 0) {
    return { authenticated: false, message: 'Token expired. Run: helpscout auth login' };
  }
  return {
    authenticated: true,
    expiresInMinutes: expiresIn,
    message: `Authenticated. Token expires in ~${expiresIn} minutes.`,
  };
}
