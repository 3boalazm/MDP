import type { Metadata } from "next";
import { StemsShowcase } from "@/app/components/StemsShowcase";
import { resolveLocale } from "@/lib/resolveLocale";
import type { Locale } from "@/lib/i18n";

const META: Record<Locale, { title: string; description: string }> = {
  ar: {
    title: "أربع مسارات، أربع ألوان — SakanWave",
    description: "الغناء والطبول والباص وباقي الآلات — كل واحد بنموذج ذكاء اصطناعي متخصص وليه لونه الخاص.",
  },
  en: {
    title: "Four stems, four colors — SakanWave",
    description: "Vocals, drums, bass, and other — each with its own specialist model and its own color.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  return META[locale];
}

export default function StemsPage() {
  return <StemsShowcase />;
}
