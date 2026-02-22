import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tektonology",
  description: "3D-printable solutions for liturgical furniture — product info, print settings, and assembly guides.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-muted`}>
        <header className="bg-background border-b border-border">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
              Tektonology
            </Link>
            <span className="text-xs text-muted-foreground">3D-printable church solutions</span>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-10">
          {children}
        </main>
        <footer className="bg-background border-t border-border mt-16">
          <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-muted-foreground">
            Tektonology — reducing suffering, one pew at a time.
          </div>
        </footer>
      </body>
    </html>
  );
}
