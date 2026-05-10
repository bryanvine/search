import { getBrand } from "@/lib/brand";

export const dynamic = "force-dynamic";

const ACCENTS: Record<string, string> = {
  buffy: "#c2410c",
  vineai: "#15803d",
};

export async function GET() {
  const brand = await getBrand();
  const accent = ACCENTS[brand.id] ?? "#c2410c";
  const iconBase = `/icon-${brand.id}`;

  const manifest = {
    name: brand.fullName,
    short_name:
      brand.id === "buffy" ? "buffy.bot" : brand.id === "vineai" ? "VineAI" : brand.fullName,
    description: brand.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1a1915",
    theme_color: accent,
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: `${iconBase}.svg`,
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: `${iconBase}-maskable.svg`,
        sizes: "192x192 512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Search",
        short_name: "Search",
        url: "/",
      },
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
