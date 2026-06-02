import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ระเบิดโคตรเสียว",
  description:
    "เกม Bomberman ออนไลน์ 4 คน วางระเบิดทำลายศัตรู เอาชีวิตรอดให้นานที่สุด มีบอท AI — จาก Biw Art Gallery",
  openGraph: {
    title: "ระเบิดโคตรเสียว | Biw Art Gallery",
    description: "เกม Bomberman ออนไลน์ 4 คน วางระเบิด มีบอท AI",
    url: "https://biwkhodseaw.22422522.xyz/bomberman",
  },
  alternates: { canonical: "/bomberman" },
};

export default function BombermanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
