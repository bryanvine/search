import type { Metadata, Viewport } from "next";
import "./globals.css";

const PUBLIC_URL = process.env.PUBLIC_BASE_URL ?? "https://search.buffy.bot";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_URL),
  title: {
    default: "buffy search — privacy-respecting meta-search",
    template: "%s — buffy search",
  },
  description:
    "Self-hosted meta-search with a custom ranking pipeline. Optional self-hosted AI answers — no third-party AI.",
  applicationName: "buffy search",
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    title: "buffy search",
    description: "Self-hosted meta-search with a custom ranking pipeline.",
    url: PUBLIC_URL,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#11110e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-serif antialiased">{children}</body>
    </html>
  );
}
