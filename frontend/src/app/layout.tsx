import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "AI Tender Compliance — Government Procurement Platform",
  description:
    "Verify bidder documents, surface risk, and keep every procurement decision transparent and audit-ready.",
  keywords: [
    "tender",
    "procurement",
    "compliance",
    "government",
    "verification",
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
