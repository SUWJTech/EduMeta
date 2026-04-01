import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "./_components/BottomNav";
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt";
import PWAServiceWorker from "@/components/pwa/PWAServiceWorker";
import PageTransition from "@/components/layout/PageTransition";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduMeta",
  description: "EduMeta Web App",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "EduMeta",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className={`${jetbrainsMono.variable} font-mono antialiased bg-black text-slate-100`}>
        <div className="mx-auto min-h-dvh w-full max-w-md bg-black px-4 pb-24 pt-6">
          <PageTransition>{children}</PageTransition>
        </div>
        <BottomNav />
        <PWAServiceWorker />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}
