import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AI Tender Compliance Platform",
  description: "Intelligent bidder verification and compliance decision support for procurement officers",
};

import AxiosSetup from "./axios-setup";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <AxiosSetup />
        {children}
      </body>
    </html>
  );
}
