import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Header } from "@/app/components/Header";
import { LocaleProvider, type Locale } from "@/lib/i18n";
import { LOCALE_COOKIE } from "@/lib/localeCookie";
import { thmanyahSerifDisplay, ibmPlexSans, ibmPlexSansArabic } from "@/lib/fonts";
import "./globals.css";

// Keyed by locale so metadata (crawlers, share previews, the tab title on
// first paint) matches a returning visitor's saved preference immediately —
// not just after client JS hydrates and corrects it.
const META: Record<Locale, { title: string; description: string }> = {
  ar: {
    title: "SakanWave",
    description: "افصل الغناء والطبول والباص عن أي أغنية محليًا جوه متصفحك — بدون رفع، بدون سيرفر.",
  },
  en: {
    title: "SakanWave",
    description: "Separate vocals, drums, and bass from any song locally in your browser — no upload, no server.",
  },
};

async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "en" ? "en" : "ar";
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const { title, description } = META[locale];
  return {
    title,
    description,
    appleWebApp: { capable: true, statusBarStyle: "default", title },
  };
}

export const viewport: Viewport = {
  themeColor: "#090b0f",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await resolveLocale();
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${thmanyahSerifDisplay.variable} ${ibmPlexSans.variable} ${ibmPlexSansArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale={locale}>
          <Header />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
