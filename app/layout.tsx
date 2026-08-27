import type { Metadata, Viewport } from "next";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";
import { LocaleProvider, type Locale } from "@/lib/i18n";
import { resolveLocale } from "@/lib/resolveLocale";
import { thmanyahSerifDisplay, ibmPlexSans, ibmPlexSansArabic } from "@/lib/fonts";
import "./globals.css";

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
          <main className="flex-1">{children}</main>
          <Footer />
        </LocaleProvider>
      </body>
    </html>
  );
}
