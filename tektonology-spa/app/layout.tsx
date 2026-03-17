import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
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
        <Providers>
          <Header />
          <main className="max-w-3xl mx-auto px-4 py-10">
            {children}
          </main>
          <footer className="bg-black border-t border-neutral-800 mt-16">
            <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-neutral-400">
              Tektonology — Godspeed.
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
