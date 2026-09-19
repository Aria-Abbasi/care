import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "سامانه مراقبت در منزل | بیمار آقای جواد یزدانی",
  description: "سامانه هوشمند مدیریت و پایش مراقبت در منزل بیمار",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#16a34a",
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
      </body>
    </html>
  );
}
