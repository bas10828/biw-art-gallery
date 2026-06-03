import type { Metadata } from "next";

const DESC =
  "A digital gallery by Biw Khodseaw — contemporary Thai paintings of trees, forests, and emotional landscapes in oil and acrylic on canvas.";

export const metadata: Metadata = {
  title: {
    default: "Biw Art Gallery | Biw Khodseaw",
    template: "%s | Biw Art Gallery",
  },
  description: DESC,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/en",
    siteName: "Biw Art Gallery",
    title: "Biw Art Gallery | Biw Khodseaw",
    description: DESC,
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
    title: "Biw Art Gallery | Biw Khodseaw",
    description: "A digital gallery by Biw Khodseaw — contemporary Thai paintings.",
    images: ["/images/exhibition-trees.png"],
  },
  alternates: {
    canonical: "/en",
    languages: {
      en: "/en",
      th: "/",
      "x-default": "/",
    },
  },
};

export default function EnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
