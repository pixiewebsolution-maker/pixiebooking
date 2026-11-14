# Pixie Webs — booking form

One page. Visitor leaves their details, picks a date and a time, and the app
creates a Google Calendar event with a Meet link. They get two emails: the
Google Calendar invite, and our own confirmation with the Meet link in the body
and an `.ics` attached.

```bash
npm install
npm run dev
```

The form works without any setup until the last step — picking a time and
confirming both need Google credentials.

## What you need to do

### 1. Create a Google Cloud project

<https://console.cloud.google.com/> → new project (any name).

### 2. Enable the APIs

**APIs & Services → Library**, and **Enable** both:

- **Google Calendar API** — creates the meeting.
- **Gmail API** — sends the confirmation email with the Meet link.

### 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen**

- User type **External** (unless you have Google Workspace — then **Internal**).
- Fill in the app name and your support/developer email.
- Add these scopes:
  - `https://www.googleapis.com/auth/calendar.events`
  - `https://www.googleapis.com/auth/calendar.readonly`
  - `https://www.googleapis.com/auth/gmail.send`
- Add the Google account that will own the meetings as a **test user**.

> **Important:** while the consent screen is in **Testing**, Google expires the
> refresh token after **7 days** and bookings will start failing. Before you go
> live, press **Publish app** so the status is *In production*. External apps
> using only Calendar scopes are not subject to Google's verification review,
> so publishing is immediate.

### 4. Create an OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Application type: **Web application**
- Authorised redirect URI: `http://localhost:5353/oauth2callback`

Copy the client ID and client secret.

### 5. Fill in your environment file

```bash
cp .env.example .env.local
```

Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in it.

### 6. Mint the refresh token

```bash
npm run google:token
```

It prints a URL. Open it, **sign in as the Google account whose calendar should
hold the meetings**, approve, and the terminal prints the token. Paste it into
`.env.local` as `GOOGLE_REFRESH_TOKEN`.

The consent screen now asks for Gmail send access as well. If you minted a
token before that scope was added, run this again — an old token cannot send
mail, and you will see `insufficient authentication scopes` in the server log.

### 7. Pick the calendar

`GOOGLE_CALENDAR_ID=primary` uses that account's main calendar. For a different
one, copy its ID from **Calendar settings → Integrate calendar**.

### 8. Restart and book a test meeting

```bash
npm run dev
```

Book a slot and check that the event shows up on the calendar and the
confirmation email arrives.

> **Test with a different address than the calendar account.** Google never
> sends a calendar invite to the organiser, so booking with the calendar
> account's own address looks like nothing was sent. Our confirmation email
> does go to it, but the Google invite will not.

### 9. When you deploy

Set the same five `GOOGLE_*` variables on the host. Nothing else carries over —
`.env.local` is gitignored and should stay that way.

## When a booking does not come through

```bash
npm run google:check                      # scopes, token health, calendar
npm run google:check -- you@example.com   # plus a real test email
```

It prints which scopes the stored refresh token actually carries, whether the
calendar is reachable, and — given an address — whether Gmail accepts a send.
Most failures are one of: a token minted before a scope was added, the Gmail
API not enabled, or the consent screen still in Testing (tokens die after 7
days).

The server log names the outcome of every booking:

```
[book] created abc123 for someone@example.com (meet: yes, email: sent)
[book] honeypot tripped, discarding submission
```

The second line means the hidden anti-spam field arrived filled in, and in
development it prints what filled it. A browser autofilling the field counts:
accepting a Chrome suggestion on any field fills every other field Chrome
thinks it can, whatever it is called. The field is `readOnly` for that reason
— browsers will not autofill a read-only input, while a bot setting `.value`
from a script still trips it.

If it ever flags a real booking again, switch it off and move on:

```bash
HONEYPOT_OFF=1   # in .env.local
```

A lost lead costs more than a spam one.

## Changing the booking rules

All in [`src/lib/slots.ts`](src/lib/slots.ts):

| Constant | Now | Means |
| --- | --- | --- |
| `DAY_START_HOUR` / `DAY_END_HOUR` | 8 / 21 | 08:00–21:00 |
| `SLOT_MINUTES` | 30 | meeting length |
| `MIN_NOTICE_HOURS` | 24 | earliest a visitor can book |
| `BOOKING_WINDOW_DAYS` | 30 | how far ahead the picker goes |
| `TIME_ZONE` | `Asia/Kolkata` | all times are IST |
| `isWorkingDay` | Mon–Sat | days offered |

Offered times already exclude anything busy on your calendar, and the server
checks free/busy again at the moment of booking.

## Good to know

- **Two emails go out.** Google sends the calendar invite (the event has the
  visitor as an attendee and `sendUpdates: "all"`), and the app sends its own
  confirmation through Gmail with the Meet link in the body plus an `.ics`
  attachment. The `.ics` reuses the Google event's UID, so calendars treat it
  as the same meeting rather than a duplicate.
- **The Meet link is fetched, not assumed.** Google provisions the room
  asynchronously, so `events.insert` usually answers before the link exists.
  The app re-reads the event until it appears — up to about five seconds.
- **A mail failure never fails a booking.** The meeting is on the calendar
  either way; the send error is logged and the page says so.
- **No database.** The calendar is the only source of truth. Two people
  confirming the same slot within the same second is theoretically possible;
  add Postgres with a unique index on the start time if that ever matters.
- **The honeypot is read off the form, not from React state, and is
  `readOnly`.** It has to catch a bot that writes straight into the DOM, and
  it must never be fillable by a browser — a controlled input called
  `company_website` managed to be exactly backwards on both counts.
  `HONEYPOT_OFF=1` disables it.
- **Rate limiting is in-process.** Fine on a normal Node host. On serverless
  each instance keeps its own counter, so use Upstash or similar if you put
  paid traffic on this.
