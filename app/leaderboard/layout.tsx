import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "อันดับคะแนนสูงสุดของ Jigsaw Puzzle — Biw Art Gallery Hall of Fame คะแนนรวมทุกภาพและแยกตามผลงาน",
  openGraph: {
    title: "Leaderboard | Biw Art Gallery",
    description: "อันดับคะแนนสูงสุดของ Jigsaw Puzzle — Hall of Fame",
    url: "https://biwkhodseaw.22422522.xyz/leaderboard",
  },
  alternates: { canonical: "/leaderboard" },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
