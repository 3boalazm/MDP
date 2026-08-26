import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/app/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Remove Vocals",
  description: "Strip vocals from a song entirely in your browser — no upload, no server.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Remove Vocals",
  },
};

export const viewport: Viewport = {
  themeColor: "#090b0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        {children}
      </body>
    </html>
  );
}
