import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azzam Mitra",
  description: "Aplikasi operasional Azzam Mitra",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
