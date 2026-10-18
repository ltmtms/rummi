import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { contentSecurityPolicy } from "@/lib/csp";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rummi — tile rummy in your browser",
  description: "A modern take on the classic Rummikub-style tile game. Play runs and groups against smart computer opponents.",
  // <meta name="referrer"> — the referrer policy browsers honor from markup.
  referrer: "strict-origin-when-cross-origin",
};

export const viewport: Viewport = {
  themeColor: "#07130f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      {/*
        GitHub Pages cannot set custom response headers, so CSP is a meta tag.
        frame-ancestors is ignored in meta CSP. Permissions-Policy is header-only.
        Neither is faked here.
      */}
      <head>
        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy()} />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="dark" position="top-center" richColors />
      </body>
    </html>
  );
}
