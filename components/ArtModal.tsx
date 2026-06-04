"use client";
import { useEffect } from "react";
import Image from "next/image";
import type { Artwork } from "@/lib/artworks";
import { useT } from "@/lib/useLocale";

export default function ArtModal({
  art,
  onClose,
}: {
  art: Artwork;
  onClose: () => void;
}) {
  const { locale, t } = useT();
  const title = locale === "en" ? art.titleEn : art.title;
  const subtitle = locale === "en" ? art.title : art.titleEn;
  const story = locale === "en" ? art.storyEn : art.story;
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handler);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center p-4 md:p-8"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ background: "rgba(0,0,0,.92)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl flex flex-col"
        style={{
          background: "var(--color-bg3)",
          border: "1px solid rgba(212,168,67,.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,.8)",
        }}
      >
        {/* image — full width, object-contain so nothing is cropped */}
        <div className="relative w-full bg-black rounded-t-2xl" style={{ minHeight: "55vh" }}>
          <Image
            src={`/images/${art.file}`}
            alt={title}
            fill
            className="object-contain rounded-t-2xl"
            sizes="(max-width:768px) 100vw, 896px"
            priority
          />
        </div>

        {/* info */}
        <div className="flex flex-col px-8 py-6">
          <p className="text-gold text-xs tracking-[.2em] uppercase mb-3">{t.modal.eyebrow}</p>
          <h2
            className="text-2xl font-bold leading-tight mb-1 text-ink"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {title}
          </h2>
          <p className="text-ink2 text-sm italic mb-1">{subtitle}</p>
          <p
            className="text-xs text-ink3 py-3 border-y mb-4"
            style={{ borderColor: "rgba(212,168,67,.12)" }}
          >
            {art.medium}
            {art.size ? ` · ${art.size}` : ""} · {art.year}
          </p>
          <div className="flex flex-col gap-3 text-ink2 text-sm leading-relaxed italic">
            {story.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-ink2 hover:text-gold transition-colors text-sm"
          style={{
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(212,168,67,.15)",
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
