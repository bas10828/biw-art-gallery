"use client";
import { useEffect } from "react";
import Image from "next/image";
import { ARTIST_PORTRAIT } from "@/lib/artworks";
import { useT } from "@/lib/useLocale";

/**
 * The artist's full story. Always rendered (hidden when closed) so the bio
 * stays in the server HTML for search engines.
 */
export default function ArtistModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div
      hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-labelledby="artist-modal-title"
      className="overlay-in fixed inset-0 z-[900] overflow-y-auto p-4 md:p-8"
      style={{ background: "rgba(3,5,11,.92)", backdropFilter: "blur(10px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-sm"
        style={{ background: "#0b0e16", border: "1px solid rgba(212,168,67,.22)", boxShadow: "0 24px 80px rgba(0,0,0,.8)" }}
      >
        <div className="grid md:grid-cols-[1fr_1.15fr]">
          <div className="relative aspect-[4/3] md:aspect-auto md:min-h-full">
            <Image
              src={`/images/${ARTIST_PORTRAIT.file}`}
              alt={`${t.about.realName} (${t.about.name})`}
              fill
              className="object-cover"
              sizes="(max-width:768px) 100vw, 45vw"
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(90deg,transparent 60%,#0b0e16)" }} />
          </div>

          <div className="flex flex-col gap-5 px-6 py-8 md:px-10 md:py-12">
            <p className="text-[11px] tracking-[.25em] uppercase text-gold">{t.about.badge}</p>
            <div>
              <h2 id="artist-modal-title" className="tour-title">
                {t.about.name}
              </h2>
              <p className="mt-2 font-serif italic text-ink2">{t.about.realName}</p>
            </div>
            <div className="h-px w-12 bg-gold/60" />
            <div className="flex flex-col gap-4 text-sm leading-relaxed text-ink2">
              <p>{t.about.bio1}</p>
              <p>{t.about.bio2}</p>
              <p className="font-serif text-base text-ink">{t.about.bio3}</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href="https://www.instagram.com/khotseaw._/" target="_blank" rel="noopener noreferrer" className="nav-pill">
                Instagram ↗
              </a>
              <a href="https://www.facebook.com/khotseaw05" target="_blank" rel="noopener noreferrer" className="nav-pill">
                Facebook ↗
              </a>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-sm text-ink2 transition-colors hover:text-gold"
          style={{ background: "rgba(3,5,11,.6)", border: "1px solid rgba(212,168,67,.2)" }}
          aria-label={t.tour.close}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
