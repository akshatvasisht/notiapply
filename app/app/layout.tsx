import type { Metadata } from "next";
import { Geist } from "next/font/google";
import ErrorBoundary from "./components/common/ErrorBoundary";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Notiapply",
  description: "Automated job application pipeline",
  icons: {
    icon: '/icon.svg',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.className}>
      <body>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
