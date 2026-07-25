import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ActivityTracker from "@/components/ActivityTracker";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Entrenadores Urdaneta",
  description: "Portal de entrenadores del Club Deportivo Urdaneta",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Urdaneta",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0c10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`h-full ${inter.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="h-full" style={{ fontFamily: "var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif" }}>
        <AuthProvider>
          <ActivityTracker />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
