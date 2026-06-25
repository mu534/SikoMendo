import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Siko Mendo Union HRMIS",
    template: "%s | Siko Mendo Union HRMIS",
  },
  description:
    "Human Resource Information Management System for Siko Mendo Union, Bale Robe, Ethiopia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
