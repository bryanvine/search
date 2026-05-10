import { headers } from "next/headers";

export type BrandId = "buffy" | "vineai";

export interface Brand {
  id: BrandId;
  prefix: string;
  italic: string;
  fullName: string;
  publicUrl: string;
  description: string;
}

const BRANDS: Record<BrandId, Brand> = {
  buffy: {
    id: "buffy",
    prefix: "buffy.bot",
    italic: "search",
    fullName: "buffy.bot search",
    publicUrl: "https://search.buffy.bot",
    description:
      "Self-hosted meta-search with a custom ranking pipeline. Optional self-hosted AI answers — no third-party AI.",
  },
  vineai: {
    id: "vineai",
    prefix: "vineai.tech",
    italic: "search",
    fullName: "vineai.tech search",
    publicUrl: "https://search.vineai.tech",
    description:
      "Self-hosted meta-search with a custom ranking pipeline. Optional self-hosted AI answers — no third-party AI.",
  },
};

function brandIdFromHost(host: string | null | undefined): BrandId {
  if (!host) return "buffy";
  const h = host.toLowerCase();
  if (h.includes("vineai")) return "vineai";
  return "buffy";
}

export async function getBrand(): Promise<Brand> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return BRANDS[brandIdFromHost(host)];
}
