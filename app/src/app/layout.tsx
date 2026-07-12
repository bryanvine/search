import type { Metadata, Viewport } from "next";
import ServiceWorker from "@/components/ServiceWorker";
import { getBrand } from "@/lib/brand";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  const iconBase = `/icon-${brand.id}`;

  return {
    metadataBase: new URL(brand.publicUrl),
    title: {
      default: `${brand.fullName} — privacy-respecting meta-search`,
      template: `%s — ${brand.fullName}`,
    },
    description: brand.description,
    applicationName: brand.fullName,
    robots: { index: false, follow: false },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: `${iconBase}.svg`, type: "image/svg+xml" }],
      apple: [{ url: `${iconBase}.svg`, sizes: "192x192", type: "image/svg+xml" }],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: brand.fullName,
    },
    other: {
      "mobile-web-app-capable": "yes",
      "msapplication-TileColor": brand.accent,
    },
    openGraph: {
      type: "website",
      title: brand.fullName,
      description: brand.description,
      url: brand.publicUrl,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#11110e" },
  ],
  colorScheme: "light dark",
  userScalable: true,
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrand();
  return (
    <html lang="en" data-brand={brand.id}>
      <body className="font-serif antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
