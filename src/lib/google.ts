import { google } from "googleapis";
import { randomUUID } from "node:crypto";

import { TIME_ZONE, type BusyInterval } from "@/lib/slots";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID || "primary";
}

/**
 * Our own calendar account, authorised once offline. The refresh token is the
 * only long lived credential; googleapis mints access tokens from it per call.
 */
function calendarClient() {
  const auth = new google.auth.OAuth2(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/oauth2callback",
  );
  auth.setCredentials({ refresh_token: requiredEnv("GOOGLE_REFRESH_TOKEN") });
  return google.calendar({ version: "v3", auth });
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
};

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

  const meetLink =
    data.hangoutLink ||
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    null;

  return { eventId: data.id, meetLink, htmlLink: data.htmlLink ?? null };
}

