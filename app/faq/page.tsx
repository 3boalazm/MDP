import type { Metadata } from "next";
import { Faq } from "@/app/components/Faq";
import { resolveLocale } from "@/lib/resolveLocale";
import type { Locale } from "@/lib/i18n";

const META: Record<Locale, { title: string; description: string }> = {
  ar: {
    title: "الأسئلة الشائعة — SakanWave",
    description: "إجابات عن الخصوصية، الصيغ المدعومة، مدة الفصل، وإيه اللي بيحصل لو الذكاء الاصطناعي ما اشتغلش.",
  },
  en: {
    title: "FAQ — SakanWave",
    description: "Answers on privacy, supported formats, how long separation takes, and the fallback engine.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  return META[locale];
}

export default function FaqPage() {
  return <Faq />;
}
