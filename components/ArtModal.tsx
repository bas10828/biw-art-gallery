"use client";
import { useEffect } from "react";
import Image from "next/image";
import type { Artwork } from "@/lib/artworks";

export default function ArtModal({
  art,
  onClose,
}: {
  art: Artwork;
  onClose: () => void;
}) {
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
      className="fixed inset-0 z-[900] flex items-center justify-center p-5"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ background: "rgba(0,0,0,.88)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl grid md:grid-cols-2"
        style={{
          background: "var(--color-bg3)",
          border: "1px solid rgba(212,168,67,.25)",
          boxShadow: "0 24px 80px rgba(0,0,0,.7)",
        }}
      >
        {/* image */}
        <div className="relative min-h-[260px]">
          <Image
            src={`/images/${art.file}`}
            alt={art.title}
            fill
            className="object-cover rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none"
            sizes="(max-width:768px) 100vw, 50vw"
          />
        </div>

        {/* info */}
        <div className="flex flex-col justify-center p-8 md:p-10">
          <p className="text-gold text-xs tracking-[.2em] uppercase mb-3">
            ✦ Original Artwork
          </p>
          <h2
            className="text-2xl font-bold leading-tight mb-1 text-ink"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {art.title}
          </h2>
          <p className="text-ink2 text-sm italic mb-1">{art.titleEn}</p>
          <p
            className="text-xs text-ink3 py-3 border-y mb-4"
            style={{ borderColor: "rgba(212,168,67,.12)" }}
          >
            {art.medium} · {art.year}
          </p>
          <p className="text-ink2 text-sm leading-relaxed italic">{art.story}</p>
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
