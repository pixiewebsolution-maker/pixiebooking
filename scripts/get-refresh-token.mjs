/**
 * One-off helper: turns a Google OAuth client into a long lived refresh token
 * for our own calendar account.
 *
 *   npm run google:token
 *
 * Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local, and
 * http://localhost:5353/oauth2callback registered as a redirect URI on the
 * OAuth client. Sign in as the calendar account that should own the meetings.
 */

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { google } from "googleapis";

const PORT = 5353;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

function loadEnvFile(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local yet: fall back to whatever is already exported.
  }
}

loadEnvFile(".env.local");

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first.");
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  // Forces a refresh token even if this account authorised the app before.
  prompt: "consent",
  scope: SCOPES,
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404).end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("No code in callback");
    return;
  }

  try {
    const { tokens } = await oauth2.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html" }).end(
      "<h1>Done.</h1><p>Refresh token printed in your terminal. You can close this tab.</p>",
    );

    if (!tokens.refresh_token) {
      console.error(
        "\nGoogle returned no refresh token. Revoke the app at " +
          "https://myaccount.google.com/permissions and run this again.",
      );
    } else {
      console.log("\nAdd this to .env.local:\n");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    }
  } catch (error) {
    console.error("Token exchange failed:", error?.message ?? error);
    res.writeHead(500).end("Token exchange failed, see terminal.");
  } finally {
    server.close();
  }
});

server.listen(PORT, () => {
  console.log("\nOpen this URL, sign in as the calendar account, and approve:\n");
  console.log(`${authUrl}\n`);
});
