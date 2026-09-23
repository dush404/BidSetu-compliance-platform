import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "BidSetu — Intelligent Verification for Better Procurement",
  description:
    "Intelligent verification for better procurement. Verify bidder documents against government registries with local AI.",
  keywords: [
    "tender",
    "procurement",
    "compliance",
    "government",
    "verification",
    "BidSetu",
  ],
  icons: {
    icon: "/mark.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f6f2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="grain antialiased bg-background text-foreground"
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-right" gap={8} />
        </ThemeProvider>
      </body>
    </html>
  );
}
