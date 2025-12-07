import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bonsai game engine",
  description: "by cnnmon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
