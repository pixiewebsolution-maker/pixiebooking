import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "Book a call — Pixie Webs",
  description:
    "Book a free 30 minute call with Pixie Webs. We design and build websites that turn visitors into customers.",
  openGraph: {
    title: "Book a call — Pixie Webs",
    description: "Free 30 minute strategy call. Pick a time that suits you.",
    images: ["/logo-full.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
