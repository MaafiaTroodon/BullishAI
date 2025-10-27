import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BullishAI - AI-Powered Stock Dashboard",
  description: "Real-time stock tracking with AI insights powered by Groq",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        {/* Botpress Webchat Script */}
        <Script
          src="https://cdn.botpress.cloud/webchat/v1/inject.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

