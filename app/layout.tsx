import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Farcaster Circle",
  description: "Visualize your Farcaster social circles",
  openGraph: {
    title: "Farcaster Circle",
    description: "See who you interact with most on Farcaster",
    images: ["https://farcaster-circle-real.vercel.app/icon.svg"],
    type: "website",
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": "https://farcaster-circle-real.vercel.app/icon.svg",
    "fc:frame:button:1": "Open App",
    "fc:frame:button:1:action": "launch_frame",
    "fc:frame:button:1:target": "https://farcaster-circle-real.vercel.app",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={outfit.className}>{children}</body>
    </html>
  );
}
