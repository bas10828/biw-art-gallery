import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { preload } from "react-dom";
import "./globals.css";
import MerchPopup from "@/components/MerchPopup";
import LocaleHtml from "@/components/LocaleHtml";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const BASE_URL = "https://biwkhodseaw.22422522.xyz";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Biw Art Gallery | บิว โคตรเสียว",
    template: "%s | Biw Art Gallery",
  },
  description:
    "แกลเลอรีงานศิลปะดิจิทัลโดย บิว โคตรเสียว — Acrylic on Canvas ผลงานที่แฝงความรู้สึกลึกๆ ไว้ในสีสัน แสง และโลกแฟนตาซี",
  keywords: [
    "Biw Art Gallery",
    "บิว โคตรเสียว",
    "khodseaw",
    "โคตรเสียว",
    "ศิลปะ",
    "Acrylic on Canvas",
    "Thai art",
    "digital gallery",
  ],
  authors: [{ name: "บิว โคตรเสียว", url: BASE_URL }],
  creator: "บิว โคตรเสียว",
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: BASE_URL,
    siteName: "Biw Art Gallery",
    title: "Biw Art Gallery | บิว โคตรเสียว",
    description:
      "แกลเลอรีงานศิลปะดิจิทัลโดย บิว โคตรเสียว — Acrylic on Canvas ผลงานที่แฝงความรู้สึกลึกๆ ไว้ในสีสัน แสง และโลกแฟนตาซี",
    images: [
      {
        url: "/images/exhibition-trees.png",
        width: 1536,
        height: 1024,
        alt: "Biw Art Gallery — khodseaw",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Biw Art Gallery | บิว โคตรเสียว",
    description: "แกลเลอรีงานศิลปะดิจิทัลโดย บิว โคตรเสียว — Acrylic on Canvas",
    images: ["/images/exhibition-trees.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: {
    canonical: "/",
    languages: {
      en: "/en",
      th: "/",
      "x-default": "/",
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  preload("/images/exhibition-trees.webp", { as: "image", fetchPriority: "high" });
  return (
    <html lang="th" className={`${playfair.variable} ${inter.variable}`}>
      <body>
        <LocaleHtml />
        {children}
        <MerchPopup />
      </body>
    </html>
  );
}
