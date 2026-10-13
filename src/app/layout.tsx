import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Brand } from "@/components/Brand";

export const metadata: Metadata = {
  title: "Grub · Your dining companion",
  icons: { icon: "/grub-bear.png" },
  description: "Scan, chat, order. Your taste profile follows you.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Brand />{children}</body>
    </html>
  );
}
