import type { Metadata, Viewport } from "next";
import { Header } from "@/app/components/Header";
import { LocaleProvider } from "@/lib/i18n";
import { thmanyahSerifDisplay, ibmPlexSans, ibmPlexSansArabic } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "استوديو التراكس",
  description: "افصل الغناء والطبول والباص عن أي أغنية محليًا جوه متصفحك — بدون رفع، بدون سيرفر.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "استوديو التراكس",
  },
};

export const viewport: Viewport = {
  themeColor: "#090b0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${thmanyahSerifDisplay.variable} ${ibmPlexSans.variable} ${ibmPlexSansArabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider initialLocale="ar">
          <Header />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
