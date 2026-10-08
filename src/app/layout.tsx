import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/toasts";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Contour — командные задачи",
  description: "Спокойное пространство для совместной работы.",
  robots: { index: false, follow: false },
  icons: {
    icon: { url: "/icon.svg", type: "image/svg+xml" },
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Nonces must be generated for the current request, never cached in static HTML.
  await connection();
  return (
    <html lang="ru" className="dark h-full antialiased">
      <body className="min-h-full"><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}
