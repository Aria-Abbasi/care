import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegistrar from "@/components/PwaRegistrar";

export const metadata: Metadata = {
  title: "سامانه مراقبت در منزل | بیمار آقای جواد یزدانی",
  description: "سامانه هوشمند مدیریت و پایش مراقبت در منزل بیمار",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "مراقبت",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <meta charSet="utf-8" />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-care-500 selection:text-white pb-safe">
        {children}
        <PwaRegistrar />
      </body>
    </html>
  );
}
