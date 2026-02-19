import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthProvider } from "@/components/auth/auth-provider";
import { HeaderAuth } from "@/components/auth/header-auth";
import { ConsensusBannerWrapper } from "@/components/consensus-banner-wrapper";
import { NavLinks } from "@/components/nav-links";
import { TradeNotificationWrapper, SidebarToggleButton, TradeSidebar, TradeToast } from "@/components/trades";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alpha Board",
  description: "Crypto market rankings and AI trading agents",
};

/**
 * Root layout with header navigation.
 * Per DESIGN_SYSTEM.md:
 * - Header: sticky, 56px height
 * - Content: centered, max-width 1200px
 * - Dark-only theme (no class toggle needed)
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[var(--bg-base)] font-sans text-[var(--text-primary)] antialiased`}
      >
        <AuthProvider>
        <TradeNotificationWrapper>
        <TooltipProvider>
          {/* Header */}
          <header className="sticky top-0 z-50 h-14 border-b border-[var(--border-default)] bg-[var(--bg-base)]">
            <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-4 sm:px-8">
              {/* Logo */}
              <Link
                href="/"
                className="font-mono text-lg font-semibold tracking-tight text-primary"
              >
                Alpha Board
              </Link>

              {/* Navigation */}
              <div className="flex items-center gap-1">
                <NavLinks />
                <SidebarToggleButton />
                <HeaderAuth />
              </div>
            </div>
          </header>

          {/* Consensus ticker banner */}
          <ConsensusBannerWrapper />

          {/* Main content */}
          <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8">
            {children}
          </main>

          {/* Trade sidebar + toast */}
          <TradeSidebar />
          <TradeToast />
        </TooltipProvider>
        </TradeNotificationWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
