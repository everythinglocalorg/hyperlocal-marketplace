import type { Metadata } from "next";
import { Geist } from "next/font/google";
import AnalyticsListener from "@/components/AnalyticsListener";
import GlobalHeader from "@/components/GlobalHeader";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://every1local.com"),
  title: "Everything Local Marketplace — Support Local, Earn Local Bucks",
  description:
    "The #1 community-driven hyper-local marketplace. Discover local vendors, earn Local Bucks, and support your community.",
  openGraph: {
    title: "Everything Local Marketplace",
    description: "Discover local vendors, earn Local Bucks, and support your community.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
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
        <GlobalHeader />
        {children}
      </body>
    </html>
  );
}
