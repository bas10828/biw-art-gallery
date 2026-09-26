import type { MetadataRoute } from "next";
import { TOUR } from "@/lib/artworks";

const BASE_URL = "https://biwkhodseaw.22422522.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const images = TOUR.map((a) => `${BASE_URL}/images/${a.file}`);
  const homeAlternates = {
    languages: { th: BASE_URL, en: `${BASE_URL}/en` },
  };
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: homeAlternates,
      images,
    },
    {
      url: `${BASE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: homeAlternates,
      images,
    },
  ];
}
