import type { Metadata } from "next";
import HomePage from "@/components/pages/HomePage";

export const metadata: Metadata = {
  title: "Biw Khodseaw — Contemporary Thai Artist",
};

export default function EnHome() {
  return <HomePage />;
}
