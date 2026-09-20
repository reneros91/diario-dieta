import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";
import { RegistraSW } from "@/components/RegistraSW";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Balanço",
  description: "Diário alimentar e corporal em formato de conversa.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Balanço", statusBarStyle: "default" },
  icons: { icon: "/icons/icone-192.png", apple: "/icons/icone-192.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F5F1" },
    { media: "(prefers-color-scheme: dark)", color: "#111614" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bricolage.variable} ${manrope.variable}`}>
      <body className="min-h-dvh antialiased">
        {children}
        <RegistraSW />
      </body>
    </html>
  );
}
