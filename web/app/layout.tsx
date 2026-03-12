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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-stone-50`}>
        <header className="bg-black border-b border-neutral-800">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold tracking-tight text-white">
              Tektonology
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/accounting" className="text-xs text-neutral-400 hover:text-white transition-colors">
                Accounting
              </Link>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-10">
          {children}
        </main>
        <footer className="bg-black border-t border-neutral-800 mt-16">
          <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-neutral-400">
            Tektonology — reducing suffering, one pew at a time.
          </div>
        </footer>
      </body>
    </html>
  );
}
