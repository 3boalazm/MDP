import type { Metadata } from "next";
import { Steps } from "@/app/components/Steps";
import { resolveLocale } from "@/lib/resolveLocale";
import type { Locale } from "@/lib/i18n";

const META: Record<Locale, { title: string; description: string }> = {
  ar: {
    title: "طريقة الاستخدام — SakanWave",
    description: "ارفع الأغنية، الفصل يتم محليًا جوه متصفحك، وبعدين استمع ونزّل كل مسار على حدة.",
  },
  en: {
    title: "How it works — SakanWave",
    description: "Drop your song, separation runs locally in your browser, then preview and download each stem.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  return META[locale];
}

export default function HowItWorksPage() {
  return <Steps />;
}
