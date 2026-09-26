"use client";
import { useEffect } from "react";
import Image from "next/image";
import type { Artwork } from "@/lib/artworks";
import { useT } from "@/lib/useLocale";

/** Full-screen index of every work — jump anywhere in the tour. */
export default function IndexOverlay({
  works,
  onPick,
  onClose,
}: {
  works: Artwork[];
  onPick: (index: number) => void;
  onClose: () => void;
}) {
  const { locale, t } = useT();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.tour.indexTitle}
      className="overlay-in fixed inset-0 z-[800] overflow-y-auto"
      style={{ background: "rgba(3,5,11,.94)", backdropFilter: "blur(14px)" }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-8"
        style={{ background: "linear-gradient(180deg,rgba(3,5,11,.95),rgba(3,5,11,0))" }}
      >
        <h2 className="font-serif text-2xl sm:text-3xl text-ink">
          {t.tour.indexTitle}
          <span className="ml-3 align-middle text-xs tracking-[.2em] text-gold">{works.length}</span>
        </h2>
        <button onClick={onClose} className="nav-pill" aria-label={t.tour.close}>
          {t.tour.close} ✕
        </button>
      </div>

      <ul className="columns-2 gap-3 px-4 pb-16 sm:gap-5 sm:px-8 md:columns-3 lg:columns-4">
        {works.map((art, i) => {
          const title = locale === "en" ? art.titleEn : art.title;
          return (
            <li key={art.id} className="mb-3 break-inside-avoid sm:mb-5">
              <button
                onClick={() => onPick(i)}
                className="group block w-full text-left"
              >
                <span className="block overflow-hidden rounded-sm bg-bg3">
                  <Image
                    src={`/images/${art.file}`}
                    alt={title}
                    width={600}
                    height={Math.round(600 / art.ratio)}
                    sizes="(max-width:768px) 50vw, (max-width:1024px) 33vw, 25vw"
                    className="h-auto w-full transition-transform duration-700 group-hover:scale-[1.04]"
                  />
                </span>
                <span className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-serif text-sm text-ink transition-colors group-hover:text-gold-light sm:text-base">
                    {title}
                  </span>
                  <span className="shrink-0 text-[10px] tracking-[.15em] text-ink3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
