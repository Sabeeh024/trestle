import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { initServerI18next, getT, getResources, generateI18nStaticParams } from "next-i18next/server";
import { I18nProvider } from "next-i18next/client";
import { notFound } from "next/navigation";
import { getDirection, isLocale } from "@trestle/i18n";
import i18nConfig from "../../i18n.config";
import { ThemeSync } from "@/components/theme-sync";
import { themeInitScript } from "@/lib/theme";
import "../globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Trestle",
  description: "Project management that keeps your team moving",
};

initServerI18next(i18nConfig);

export async function generateStaticParams() {
  return generateI18nStaticParams();
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lng: string }>;
}) {
  const { lng } = await params;
  if (!isLocale(lng)) notFound();

  const { i18n } = await getT();
  const resources = getResources(i18n);

  return (
    // suppressHydrationWarning: the theme script adds the "dark" class before React hydrates.
    <html lang={lng} dir={getDirection(lng)} className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeSync />
        <I18nProvider language={lng} resources={resources}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
