# Pixie Webs — booking site

Mobile-first landing page for Instagram ad traffic. A visitor leaves their name,
email and phone, picks a free 30 minute slot from our real Google Calendar, and
walks away with a Meet invite in their inbox. Every lead lands in Supabase with
its UTM tags.

**Stack:** Next.js (App Router) · Tailwind CSS v4 · Supabase · Google Calendar API

---

## How it works

```
/                     landing page + form (name, email, phone, date, time)
GET  /api/slots?date= free/busy lookup, returns the bookable slots for that day
POST /api/book        re-checks, claims the slot, creates the event, saves the lead
/confirmed?ref=       thank-you page
```

Booking rules, all enforced on the server in `src/lib/slots.ts`:

| Rule | Value |
| --- | --- |
| Meeting length | 30 minutes |
| Days | Monday to Saturday |
| Hours | 10:00 – 18:00 IST (last start 17:30) |
| Minimum notice | 24 hours |
| Booking window | 30 days ahead |

India has no daylight saving, so IST is treated as a fixed +05:30 offset — no
timezone library needed.

### Double booking

Three layers, because free/busy alone is eventually consistent:

1. `/api/slots` hides anything Google reports as busy.
2. `/api/book` re-queries free/busy for that exact slot at submit time.
3. A **unique index on `bookings.start_time`** settles two requests that arrive
   in the same second. The row is claimed *before* the calendar event is
   created; if Google then fails, the row is deleted and the slot reopens.

---

## Setup

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Google Cloud

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and
   create a project (e.g. *Pixie Webs Booking*).
2. **APIs & Services → Library →** enable **Google Calendar API**.
3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - Fill in app name, support email, developer email.
   - Scopes: add `.../auth/calendar.events` and `.../auth/calendar.readonly`.
   - Add the calendar account (the Google account that owns the meetings) as a
     **Test user**.
   - You can leave the app in **Testing**. A test-user refresh token expires
     after 7 days, so **Publish** the app once you go live — published tokens
     do not expire unless revoked.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorised redirect URI: `http://localhost:5353/oauth2callback`
   - Copy the client ID and secret into `.env.local`.
5. Mint the refresh token:

   ```bash
   npm run google:token
   ```

   Open the printed URL, **sign in as the calendar account**, approve, and copy
   the `GOOGLE_REFRESH_TOKEN=` line it prints into `.env.local`.
6. Optional: set `GOOGLE_CALENDAR_ID` if meetings should land on a calendar
   other than that account's primary one (Calendar settings → Integrate
   calendar → Calendar ID).

> Google Meet links are created through `conferenceData` on the event, so the
> calendar account needs a Google Workspace or normal Gmail account with Meet
> available.

### 3. Supabase

1. Create a project at [supabase.com](https://supabase.com/).
2. **SQL Editor → New query →** paste and run [`supabase/schema.sql`](supabase/schema.sql).
3. **Project Settings → API →** copy the **Project URL** into
   `NEXT_PUBLIC_SUPABASE_URL` and the **`service_role` key** into
   `SUPABASE_SERVICE_ROLE_KEY`.

The service role key bypasses row level security and is only ever imported by
route handlers (`runtime = "nodejs"`), never by a client component.

### 4. Run

```bash
npm run dev
```

http://localhost:3000 — try `?utm_source=instagram&utm_campaign=launch` to see
UTM capture working.

---

## Environment variables

| Variable | What it is |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Offline token for the calendar account |
| `GOOGLE_REDIRECT_URI` | Only used while minting the token |
| `GOOGLE_CALENDAR_ID` | `primary` or a specific calendar id |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase key |
| `NEXT_PUBLIC_SITE_URL` | Public URL, used for Open Graph links |

Set the same values in your host's dashboard before deploying. Nothing secret is
exposed to the browser — the only `NEXT_PUBLIC_` value is the Supabase URL.

---

## Spam and abuse

- **Honeypot** — a visually hidden `company_website` field. If it is filled, the
  API returns a success shape and creates nothing.
- **Rate limiting** — 5 booking attempts per IP per 10 minutes, 60 slot lookups
  per minute (`src/lib/rate-limit.ts`).
- **Server-side slot validation** — a tampered payload cannot book 3am on a
  Sunday; `isLegalSlotStart` re-derives the rules from scratch.

The limiter lives in process memory. That is fine on a long-running Node server,
but on serverless each instance keeps its own counter. If the ads scale up, swap
the store in `rate-limit.ts` for Upstash Redis — the function signature is
designed to be a drop-in.

---

## UTM tracking

`utm_source`, `utm_medium`, `utm_campaign`, `utm_term` and `utm_content` are read
from the URL on landing, kept in `sessionStorage` so they survive a reload, and
written to the booking row along with `document.referrer`.

Suggested Instagram ad link:

```
https://yourdomain.com/?utm_source=instagram&utm_medium=paid&utm_campaign=<campaign>&utm_content=<creative>
```

---

## Project layout

```
src/
  app/
    page.tsx              landing page
    confirmed/page.tsx    thank-you page (reads the lead back from Supabase)
    api/slots/route.ts    free/busy → available slots
    api/book/route.ts     validate → re-check → claim → create event → save lead
  components/
    BookingForm.tsx       form state, UTM capture, submit
    DatePicker.tsx        horizontal day strip
    SlotPicker.tsx        time grid
    Field.tsx             labelled input with inline error
  lib/
    slots.ts              all booking rules and IST maths
    google.ts             OAuth client, free/busy, event creation
    supabase.ts           server-only client
    rate-limit.ts         in-memory sliding window
    validation.ts         zod schemas shared by client and server
supabase/schema.sql       bookings table
scripts/get-refresh-token.mjs
```

---

## Deploying

Push to Vercel (or any Node host), add the environment variables, and
point the domain at it. Then update `GOOGLE_REDIRECT_URI` only if you ever need
to mint a fresh token — the running app never uses it.
