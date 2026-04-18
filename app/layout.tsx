import type { Metadata } from "next";
import { Fredoka, Poppins } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Certificate Verification | PharmacoZyme",
  description: "Verify the authenticity of any PharmacoZyme certificate. Instant verification powered by tamper-proof technology.",
  keywords: ["certificate verification", "PharmacoZyme", "authentic certificate", "digital certificate"],
  openGraph: {
    title: "Certificate Verification | PharmacoZyme",
    description: "Verify the authenticity of any PharmacoZyme certificate",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />
      </head>
      <body className={`${fredoka.variable} ${poppins.variable} min-h-screen flex flex-col antialiased`}>
        {children}
      </body>
    </html>
  );
}
