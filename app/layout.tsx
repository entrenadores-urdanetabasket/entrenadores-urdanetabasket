import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Entrenadores Urdaneta",
  description: "Portal de entrenadores del Club Deportivo Urdaneta",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
