import { google, type calendar_v3 } from "googleapis";
import { randomUUID } from "node:crypto";

import { TIME_ZONE, type BusyInterval } from "@/lib/slots";

// Meet rooms are provisioned asynchronously, so events.insert often answers
// before the link exists. We re-read the event until Google fills it in.
const MEET_POLL_ATTEMPTS = 6;
const MEET_POLL_DELAY_MS = 800;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

/**
 * Our own Google account, authorised once offline. The refresh token is the
 * only long lived credential; googleapis mints access tokens from it per call.
 * Shared with the mailer so calendar and Gmail speak as the same account.
 */
export function oauthClient() {
  const auth = new google.auth.OAuth2(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback",
  );
  auth.setCredentials({ refresh_token: requiredEnv("GOOGLE_REFRESH_TOKEN") });
  return auth;
}

function calendarClient() {
  return google.calendar({ version: "v3", auth: oauthClient() });
}

export async function getBusyIntervals(timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
  const calendar = calendarClient();
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: TIME_ZONE,
      items: [{ id: calendarId() }],
    },
  });

  const busy = data.calendars?.[calendarId()]?.busy ?? [];
  return busy
    .filter((b): b is { start: string; end: string } => Boolean(b.start && b.end))
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export type CreatedEvent = {
  eventId: string;
  meetLink: string | null;
  htmlLink: string | null;
  iCalUid: string | null;
  organizerEmail: string | null;
};

function meetLinkOf(event: calendar_v3.Schema$Event): string | null {
  return (
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ||
    null
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForMeetLink(
  calendar: calendar_v3.Calendar,
  eventId: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < MEET_POLL_ATTEMPTS; attempt += 1) {
    await wait(MEET_POLL_DELAY_MS);

    const { data } = await calendar.events.get({ calendarId: calendarId(), eventId });
    const link = meetLinkOf(data);
    if (link) return link;

    const status = data.conferenceData?.createRequest?.status?.statusCode;
    if (status === "failure") {
      console.error("[google] Meet room creation failed for event", eventId);
      return null;
    }
  }

  console.error("[google] Meet link did not appear in time for event", eventId);
  return null;
}

export async function createBookingEvent(params: {
  name: string;
  email: string;
  phone: string;
  start: Date;
  end: Date;
}): Promise<CreatedEvent> {
  const calendar = calendarClient();

  const { data } = await calendar.events.insert({
    calendarId: calendarId(),
    conferenceDataVersion: 1,
    // Emails the Google Calendar invite to the client.
    sendUpdates: "all",
    requestBody: {
      summary: `Pixie Webs intro call — ${params.name}`,
      description: [
        "30 minute discovery call with Pixie Webs.",
        "",
        `Name: ${params.name}`,
        `Email: ${params.email}`,
        `Phone: ${params.phone}`,
        "",
        "Join with the Google Meet link on this invite. Reply here to reschedule.",
      ].join("\n"),
      start: { dateTime: params.start.toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: params.end.toISOString(), timeZone: TIME_ZONE },
      attendees: [{ email: params.email, displayName: params.name }],
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 60 },
          { method: "popup", minutes: 10 },
        ],
      },
    },
  });

  if (!data.id) throw new Error("Google Calendar did not return an event id");

  const meetLink = meetLinkOf(data) ?? (await waitForMeetLink(calendar, data.id));

  return {
    eventId: data.id,
    meetLink,
    htmlLink: data.htmlLink ?? null,
    iCalUid: data.iCalUID ?? null,
    organizerEmail: data.organizer?.email ?? null,
  };
}
