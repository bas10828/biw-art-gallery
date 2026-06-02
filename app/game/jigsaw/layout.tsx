import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jigsaw Puzzle",
  description:
    "ต่อภาพผลงานศิลปะของ บิว โคตรเสียว ให้สมบูรณ์ วัดความเร็วและความแม่นยำ — ระดับ 3×3, 4×4, 5×5",
  openGraph: {
    title: "Jigsaw Puzzle | Biw Art Gallery",
    description: "ต่อภาพผลงานศิลปะของ บิว โคตรเสียว — ระดับ 3×3, 4×4, 5×5",
    url: "https://biwkhodseaw.22422522.xyz/game/jigsaw",
  },
  alternates: { canonical: "/game/jigsaw" },
};

export default function JigsawLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
