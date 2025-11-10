import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalNavbar } from "@/components/GlobalNavbar";
import { AnimationRoot } from "@/components/anim/AnimationRoot";
import { ToastContainer } from "@/components/Toast";

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
        {/* Load three.js globally for LiquidEther without bundling */}
        <GlobalNavbar />
        {children}
        <AnimationRoot />
        <ToastContainer />
        <Footer />
      </body>
    </html>
  );
}

