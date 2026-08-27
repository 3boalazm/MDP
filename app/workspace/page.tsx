import type { Metadata } from "next";
import { WorkspaceClient } from "./WorkspaceClient";
import { resolveLocale } from "@/lib/resolveLocale";
import type { Locale } from "@/lib/i18n";

const META: Record<Locale, { title: string; description: string }> = {
  ar: {
    title: "مساحة العمل — SakanWave",
    description: "ارفع أغنيتك وافصلها لأربع مسارات — الغناء والطبول والباص وباقي الآلات — محليًا جوه متصفحك.",
  },
  en: {
    title: "Workspace — SakanWave",
    description: "Upload your song and separate it into four stems — vocals, drums, bass, other — locally in your browser.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  return META[locale];
}

export default function WorkspacePage() {
  return <WorkspaceClient />;
}
