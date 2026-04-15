import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { RainbowProvider } from "@/components/RainbowProvider";

export const metadata: Metadata = {
  title: "TradeRail",
  description: "Paid execution intelligence on X Layer",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RainbowProvider>{children}</RainbowProvider>
      </body>
    </html>
  );
}
