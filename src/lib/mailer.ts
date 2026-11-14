import { google } from "googleapis";
import { randomUUID } from "node:crypto";

import { oauthClient } from "@/lib/google";
import { TIME_ZONE, toISTClock as clock } from "@/lib/slots";

/**
 * The confirmation email we send ourselves, on top of the Google Calendar
 * invite. Two reasons it exists:
 *
 *  - Google never emails an invite to the organiser, so booking with the
 *    calendar account's own address looks like nothing was sent.
 *  - The Meet link only lives inside the calendar entry. This puts it in the
 *    client's inbox, in plain sight, with an .ics for non-Google calendars.
 *
 * It goes out through Gmail on the same OAuth client as the calendar, so there
 * is no third party mail provider to set up.
 */

const FROM_NAME = process.env.MAIL_FROM_NAME || "Pixie Webs";

export type InviteMail = {
  name: string;
  email: string;
  phone: string;
  start: Date;
  end: Date;
  meetLink: string | null;
  eventLink: string | null;
  iCalUid: string | null;
  organizerEmail: string | null;
};

/* ---------------------------------------------------------------- formatting */

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/* ---------------------------------------------------------------- ics */

function icsStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 caps a content line at 75 octets; continuations start with a space. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    let end = Math.min(offset + (offset === 0 ? 75 : 74), bytes.length);
    // Never cut through the middle of a multi-byte character.
    while (end > offset + 1 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    parts.push((offset === 0 ? "" : " ") + bytes.subarray(offset, end).toString("utf8"));
    offset = end;
  }
  return parts.join("\r\n");
}

function buildIcs(invite: InviteMail): string {
  const summary = `Pixie Webs intro call — ${invite.name}`;
  const description = [
    "30 minute discovery call with Pixie Webs.",
    invite.meetLink ? `Join: ${invite.meetLink}` : "",
    "",
    `Name: ${invite.name}`,
    `Phone: ${invite.phone}`,
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pixie Webs//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    // Same UID as the Google event, so calendars treat this as that event
    // rather than adding a duplicate.
    `UID:${invite.iCalUid ?? `${invite.start.getTime()}@pixiewebs`}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(invite.start)}`,
    `DTEND:${icsStamp(invite.end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    invite.meetLink ? `LOCATION:${icsEscape(invite.meetLink)}` : "",
    invite.organizerEmail
      ? `ORGANIZER;CN=${icsEscape(FROM_NAME)}:mailto:${invite.organizerEmail}`
      : "",
    `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${icsEscape(
      invite.name,
    )}:mailto:${invite.email}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return `${lines.map(fold).join("\r\n")}\r\n`;
}

/* ---------------------------------------------------------------- body */

function plainBody(invite: InviteMail): string {
  return [
    `Hi ${invite.name.split(" ")[0]},`,
    "",
    "Your call with Pixie Webs is confirmed.",
    "",
    `When: ${dayFormat.format(invite.start)}`,
    `Time: ${clock(invite.start)} - ${clock(invite.end)} IST (30 minutes)`,
    ...(invite.meetLink ? [`Google Meet: ${invite.meetLink}`] : []),
    ...(invite.eventLink ? [`Calendar: ${invite.eventLink}`] : []),
    "",
    "The .ics attached adds this to any calendar app.",
    "Need another time? Just reply to this email.",
    "",
    "- Pixie Webs",
  ].join("\n");
}

function htmlBody(invite: InviteMail): string {
  const button = invite.meetLink
    ? `<tr><td style="padding:28px 0 4px;">
         <a href="${invite.meetLink}" style="display:inline-block;background:#1d6ef5;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:12px;">Join the Google Meet</a>
       </td></tr>
       <tr><td style="padding:10px 0 0;font-size:13px;color:#9aa8bd;word-break:break-all;">${invite.meetLink}</td></tr>`
    : `<tr><td style="padding:24px 0 0;font-size:14px;color:#6b7a90;">The Google Meet link is on the calendar invite.</td></tr>`;

  const calendarRow = invite.eventLink
    ? `<tr><td style="padding:22px 0 0;font-size:14px;color:#6b7a90;">
         <a href="${invite.eventLink}" style="color:#1d6ef5;text-decoration:none;">View on Google Calendar</a>
       </td></tr>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f7fc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fc;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;padding:36px 34px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#11203d;">
    <tr><td style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9aa8bd;font-weight:600;">Pixie Webs</td></tr>
    <tr><td style="padding:14px 0 0;font-size:24px;font-weight:700;letter-spacing:-.02em;">You're booked, ${invite.name.split(" ")[0]}.</td></tr>
    <tr><td style="padding:10px 0 0;font-size:15px;line-height:1.55;color:#6b7a90;">Here are the details for our 30 minute call.</td></tr>
    <tr><td style="padding:24px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fd;border-radius:14px;padding:18px 20px;">
        <tr><td style="font-size:13px;color:#9aa8bd;padding-bottom:4px;">When</td></tr>
        <tr><td style="font-size:16px;font-weight:600;">${dayFormat.format(invite.start)}</td></tr>
        <tr><td style="font-size:16px;font-weight:600;padding-top:2px;">${clock(invite.start)} – ${clock(invite.end)} IST</td></tr>
      </table>
    </td></tr>
    ${button}
    ${calendarRow}
    <tr><td style="padding:26px 0 0;border-top:1px solid #e8edf5;margin-top:26px;font-size:13px;line-height:1.6;color:#9aa8bd;">
      The .ics attached adds this to any calendar app. Need another time? Just reply to this email.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

/* ---------------------------------------------------------------- mime */

function encodeHeader(value: string): string {
  // Anything outside printable ASCII needs an encoded-word per RFC 2047.
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function address(name: string, email: string): string {
  return `"${encodeHeader(name).replace(/"/g, "")}" <${email}>`;
}

function base64Part(value: string): string {
  return (
    Buffer.from(value, "utf8")
      .toString("base64")
      .match(/.{1,76}/g) ?? []
  ).join("\r\n");
}

function buildMime(invite: InviteMail): string {
  const mixed = `mixed_${randomUUID()}`;
  const alternative = `alt_${randomUUID()}`;
  const from = process.env.MAIL_FROM || invite.organizerEmail;

  const headers = [
    // With no From header Gmail fills in the authenticated account itself,
    // which is the safe fallback when we cannot name a sendable address.
    from ? `From: ${address(FROM_NAME, from)}` : "",
    `To: ${address(invite.name, invite.email)}`,
    from ? `Reply-To: ${address(FROM_NAME, from)}` : "",
    `Subject: ${encodeHeader(
      `Your Pixie Webs call — ${dayFormat.format(invite.start)}, ${clock(invite.start)} IST`,
    )}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
  ].filter(Boolean);

  return [
    ...headers,
    "",
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    "",
    `--${alternative}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Part(plainBody(invite)),
    `--${alternative}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Part(htmlBody(invite)),
    `--${alternative}--`,
    "",
    `--${mixed}`,
    'Content-Type: text/calendar; charset="UTF-8"; method=REQUEST; name="pixie-webs-call.ics"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: attachment; filename="pixie-webs-call.ics"',
    "",
    base64Part(buildIcs(invite)),
    `--${mixed}--`,
    "",
  ].join("\r\n");
}

/* ---------------------------------------------------------------- send */

/**
 * Sends the confirmation. Never throws: a meeting that is on the calendar is
 * still a booking, so a mail failure must not fail the request.
 */
export async function sendConfirmationEmail(invite: InviteMail): Promise<boolean> {
  try {
    const gmail = google.gmail({ version: "v1", auth: oauthClient() });
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: Buffer.from(buildMime(invite), "utf8").toString("base64url") },
    });
    return true;
  } catch (error) {
    console.error(
      "[mail] confirmation email failed. If this says insufficient scopes, enable the " +
        "Gmail API and re-run `npm run google:token` to add gmail.send.",
      error,
    );
    return false;
  }
}
