import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

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
    <html lang="en" className={`${inter.variable} ${lexend.variable} h-full`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
