import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const mono = JetBrains_Mono({
 variable: "--font-mono",
 subsets: ["latin"],
});

export const metadata: Metadata = {
 title: "DevMate AI",
 description: "AI-powered developer assistant for review, debugging, and CI/CD generation",
};

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
 <html lang="en" className={cn("font-sans", geist.variable)}>
 <body className={`${geist.variable} ${mono.variable} antialiased`}>
 {children}
 </body>
 </html>
 );
}
