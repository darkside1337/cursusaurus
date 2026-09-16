import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { fontSignifier, fontSohne } from "./fonts";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cursusaurus",
  description: "Course platform with one-time purchases and All-Access subscription pass",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fontSohne.variable} ${fontSignifier.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
