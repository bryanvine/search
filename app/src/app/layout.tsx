import type { Metadata, Viewport } from "next";
import { getBrand } from "@/lib/brand";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return {
    metadataBase: new URL(brand.publicUrl),
    title: {
      default: `${brand.fullName} — privacy-respecting meta-search`,
      template: `%s — ${brand.fullName}`,
    },
    description: brand.description,
    applicationName: brand.fullName,
    robots: { index: false, follow: false },
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#11110e" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrand();
  return (
    <html lang="en" data-brand={brand.id}>
      <body className="font-serif antialiased">{children}</body>
    </html>
  );
}
