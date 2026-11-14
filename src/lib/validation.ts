import { z } from "zod";

const phone = z
  .string({ required_error: "Enter your phone number" })
  .trim()
  .min(8, "Enter a valid phone number")
  .max(24, "Enter a valid phone number")
  .refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 8 && digits.length <= 15 && /^\+?[\d\s()\-.]+$/.test(value);
  }, "Enter a valid phone number, with country code if outside India");

export const bookingSchema = z.object({
  name: z.string({ required_error: "Enter your full name" }).trim().min(2, "Enter your full name").max(80),
  email: z
    .string({ required_error: "Enter a valid email address" })
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(160),
  phone,
  start: z
    .string({ required_error: "Pick a time that works for you" })
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Pick a time that works for you"),
  // Honeypot. Accepted by the schema so the route can quietly swallow the
  // submission instead of telling a bot which field gave it away. The name is
  // meaningless on purpose: anything a browser can classify gets autofilled.
  contact_ref_id: z.string().max(200).optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again";
}
