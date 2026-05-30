import type { Metadata } from "next";
import "./globals.css";
import MerchPopup from "@/components/MerchPopup";

export const metadata: Metadata = {
  title: "Biw Art Gallery",
  description: "ผลงานศิลปะดิจิทัลโดย Biw",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        {children}
        <MerchPopup />
      </body>
    </html>
  );
}
