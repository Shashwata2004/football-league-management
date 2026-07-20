import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Football League Management System",
  description: "Custom football league management with approvals, fixtures, simulation, and standings"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" />
      </head>
      <body suppressHydrationWarning>
        <SiteNav />
        <main>{children}</main>
      </body>
    </html>
  );
}
