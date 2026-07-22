import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import AnalyticsListener from "@/components/AnalyticsListener";
import GlobalHeader from "@/components/GlobalHeader";
import CartDrawer from "@/components/CartDrawer";
import CartButton from "@/components/CartButton";
import { CartProvider } from "@/lib/cart";
import { FavoritesProvider } from "@/lib/favorites";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://everythinglocal.org"),
  title: "Rent, Shop, Sell and Discover Everything in Your Town!",
  description:
    "The #1 community-driven hyper-local marketplace. Discover local businesses, earn Local Bucks, and support your community.",
  openGraph: {
    title: "Everything Local Marketplace",
    description: "Discover local businesses, earn Local Bucks, and support your community.",
    type: "website",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "Everything Local — Browse Local Like Never Before" }],
  },
  twitter: { card: "summary_large_image", images: ["/api/og"] },
  // Installed-to-home-screen (iOS): launch full-screen, no Safari chrome.
  appleWebApp: {
    capable: true,
    title: "Everything Local",
    statusBarStyle: "default",
  },
};

// Tints the browser/OS UI (Android address bar, iOS PWA status bar) brand green.
export const viewport: Viewport = {
  themeColor: "#00a63e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${geist.className} min-h-full flex flex-col bg-white text-gray-900`}>
        <AnalyticsListener />
        <FavoritesProvider>
          <CartProvider>
            <GlobalHeader />
            {children}
            <CartButton />
            <CartDrawer />
          </CartProvider>
        </FavoritesProvider>
      </body>
    </html>
  );
}
