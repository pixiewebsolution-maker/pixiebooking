/**
 * Diagnostic: says exactly what the stored refresh token can and cannot do.
 *
 *   npm run google:check                  # report only
 *   npm run google:check -- you@mail.com  # also send a real test email
 *
 * Reads .env.local, mints an access token, and asks Google which scopes that
 * token actually carries. Most booking problems are one of: a token minted
 * before a scope was added, the Gmail API not enabled on the project, or the
 * consent screen still in Testing (tokens expire after 7 days).
 */

import { readFileSync } from "node:fs";
import { google } from "googleapis";

const NEEDED = {
  "https://www.googleapis.com/auth/calendar.events": "create the meeting",
  "https://www.googleapis.com/auth/calendar.readonly": "read free/busy",
  "https://www.googleapis.com/auth/gmail.send": "send the confirmation email",
};

function loadEnvFile(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local: fall back to whatever is already exported.
  }
}

loadEnvFile(".env.local");

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

console.log("\n--- environment ---");
for (const [name, value] of [
  ["GOOGLE_CLIENT_ID", clientId],
  ["GOOGLE_CLIENT_SECRET", clientSecret],
  ["GOOGLE_REFRESH_TOKEN", refreshToken],
]) {
  console.log(`${value ? "  ok  " : "  MISSING"}  ${name}${value ? ` (${value.slice(0, 12)}…)` : ""}`);
}
console.log(`  ok    GOOGLE_CALENDAR_ID = ${calendarId}`);

if (!clientId || !clientSecret || !refreshToken) {
  console.error("\nFill in .env.local first, then run this again.");
  process.exit(1);
}

const auth = new google.auth.OAuth2(clientId, clientSecret);
auth.setCredentials({ refresh_token: refreshToken });

let accessToken;
try {
  accessToken = (await auth.getAccessToken()).token;
} catch (error) {
  console.error("\n--- the refresh token is not usable ---");
  console.error(error?.response?.data ?? error?.message ?? error);
  console.error(
    "\ninvalid_grant usually means the token was revoked, or the consent screen\n" +
      "is still in Testing and the token aged out after 7 days.\n" +
      "Run `npm run google:token` again.",
  );
  process.exit(1);
}

const info = await fetch(
  `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
).then((response) => response.json());

const granted = String(info.scope ?? "").split(" ").filter(Boolean);

console.log("\n--- scopes this token actually carries ---");
let missing = 0;
for (const [scope, why] of Object.entries(NEEDED)) {
  const has = granted.includes(scope);
  if (!has) missing += 1;
  console.log(`${has ? "  ok  " : "  MISSING"}  ${scope.split("/auth/")[1]}  (${why})`);
}
for (const scope of granted) {
  if (!(scope in NEEDED)) console.log(`  extra   ${scope}`);
}

if (missing) {
  console.error(
    "\nThis token predates the scopes above. Add them on the OAuth consent\n" +
      "screen, enable the matching API in the Library, then run\n" +
      "`npm run google:token` and paste the NEW refresh token into .env.local.",
  );
}

console.log("\n--- calendar ---");
try {
  const calendar = google.calendar({ version: "v3", auth });
  const { data } = await calendar.calendars.get({ calendarId });
  console.log(`  ok    reachable: ${data.summary} (${data.id})`);
  console.log(`        meetings land here, and this account never emails itself an invite`);
} catch (error) {
  console.log(`  FAIL  ${error?.errors?.[0]?.message ?? error?.message ?? error}`);
}

const recipient = process.argv[2];
if (!recipient) {
  console.log("\nPass an address to send a real test email:");
  console.log("  npm run google:check -- you@example.com\n");
  process.exit(missing ? 1 : 0);
}

console.log(`\n--- sending a test email to ${recipient} ---`);
const message = [
  `To: ${recipient}`,
  "Subject: Pixie Webs test email",
  'Content-Type: text/plain; charset="UTF-8"',
  "",
  "If you are reading this, the Gmail side of the booking form works.",
  "",
].join("\r\n");

try {
  const gmail = google.gmail({ version: "v1", auth });
  const { data } = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: Buffer.from(message, "utf8").toString("base64url") },
  });
  console.log(`  ok    Gmail accepted it, message id ${data.id}`);
  console.log("        It is in the Sent folder of the account you authorised.");
  console.log("        Not in the inbox? Check Spam, and the Promotions tab.");
} catch (error) {
  console.log("  FAIL  Gmail refused the send:");
  console.log(JSON.stringify(error?.response?.data ?? { message: error?.message }, null, 2));
}
