import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mini Games",
  description:
    "เกมมินิจาก Biw Art Gallery — Jigsaw Puzzle ต่อภาพผลงานศิลปะ และ ระเบิดโคตรเสียว เกม Bomberman ออนไลน์ 4 คน",
  openGraph: {
    title: "Mini Games | Biw Art Gallery",
    description: "เกมมินิจาก Biw Art Gallery — Jigsaw Puzzle และ ระเบิดโคตรเสียว",
    url: "https://biwkhodseaw.22422522.xyz/game",
  },
  alternates: { canonical: "/game" },
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
