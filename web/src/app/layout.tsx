import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { HeaderAuth } from "@/components/auth/header-auth";
import { TerminalLogo } from "@/components/terminal";
import { NavLinks } from "@/components/nav-links";
import { TradeNotificationWrapper, SidebarToggleButton, TradeSidebar, TradeToast } from "@/components/trades";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Footer } from "@/components/footer";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} flex min-h-screen flex-col bg-dot-matrix font-sans text-text-primary antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-none focus:bg-void-surface focus:px-4 focus:py-2 focus:text-sm focus:text-text-primary"
        >
          Skip to content
        </a>
        <AuthProvider>
        <TradeNotificationWrapper>
        <TooltipProvider>
          {/* Header */}
          <header className="sticky top-0 z-50 h-14 border-b border-void-border bg-void">
            <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between px-4 sm:px-6 lg:px-8">
              {/* Logo */}
              <TerminalLogo />

              {/* Navigation */}
              <div className="flex items-center gap-1">
                <NavLinks />
                <SidebarToggleButton />
                <HeaderAuth />
              </div>
            </div>
          </header>

          {/* Main content */}
          <main id="main-content" className="w-full max-w-[1800px] mx-auto flex-1 px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>

          {/* Footer */}
          <Footer />

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
