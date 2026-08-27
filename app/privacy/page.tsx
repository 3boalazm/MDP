import type { Metadata } from "next";
import { Privacy } from "@/app/components/Privacy";
import { resolveLocale } from "@/lib/resolveLocale";
import type { Locale } from "@/lib/i18n";

const META: Record<Locale, { title: string; description: string }> = {
  ar: {
    title: "الخصوصية — SakanWave",
    description: "إيه اللي بيحصل فعليًا لصوتك — المعالجة على الجهاز، تخزين النماذج، ووضع السرعة الاختياري.",
  },
  en: {
    title: "Privacy — SakanWave",
    description: "What actually happens to your audio — on-device processing, model caching, and optional Fast Mode.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  return META[locale];
}

export default function PrivacyPage() {
  return <Privacy />;
}
