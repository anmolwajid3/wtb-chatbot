import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/brand";
import { getLocale, getTheme } from "@/lib/i18n";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: "A matching workspace companies can adopt and shape.",
  icons: { icon: "/opas.png" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const theme = await getTheme();

  return (
    <html lang={locale} className={`${theme} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
