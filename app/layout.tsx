import type { Metadata } from "next";
import "./globals.css";
import MerchPopup from "@/components/MerchPopup";

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
        width: 1200,
        height: 630,
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
  },
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
