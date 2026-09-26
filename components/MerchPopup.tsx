"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { useLocale } from "@/lib/useLocale";

// ── เพิ่มสินค้า/โฆษณาใหม่ที่นี่ ──────────────────────────────────────
const TEE = { desc: "เสื้อยืด limited · 3 สี\nดำ · ขาว · น้ำเงิน", descEn: "Limited tee · 3 colours\nblack · white · blue" };
const VINTAGE = { desc: "เสื้อยืดสีดำฟอก สไตล์วินเทจ\ncotton 100% · 275G", descEn: "Washed-black vintage tee\n100% cotton · 275G" };
const SHOPEE = "https://s.shopee.co.th/17ZEn4Vl5";

const ADS = [
  { image: "/images/merch-black.jpg",                tag: "Merch",  title: "โคตรเสียว",         ...TEE,     link: SHOPEE },
  { image: "/images/merch-white.jpg",                tag: "Merch",  title: "โคตรเสียว",         ...TEE,     link: SHOPEE },
  { image: "/images/merch-flatlay.jpg",              tag: "Merch",  title: "โคตรเสียว",         ...TEE,     link: SHOPEE },
  { image: "/images/merch-lifestyle-gallery.png",    tag: "Merch",  title: "โคตรเสียว",         ...TEE,     link: SHOPEE },
  { image: "/images/merch-lifestyle-gallery-bw.png", tag: "Merch",  title: "โคตรเสียว",         ...TEE,     link: SHOPEE },
  { image: "/images/merch-lifestyle-sea.png",        tag: "Merch",  title: "โคตรเสียว",         ...TEE,     link: SHOPEE },
  { image: "/images/merch-washed-flat.jpg",          tag: "Merch",  title: "โคตรเสียว Vintage", ...VINTAGE, link: SHOPEE },
  { image: "/images/merch-washed-box.jpg",           tag: "Merch",  title: "โคตรเสียว Vintage", ...VINTAGE, link: SHOPEE },
  { image: "/images/merch-lifestyle-biw.png",        tag: "Artist", title: "บิว โคตรเสียว",     desc: "ศิลปินดิจิทัล · Digital Art 2026", descEn: "Artist · Digital Art 2026", link: "https://www.instagram.com/khotseaw._" },
];
// ─────────────────────────────────────────────────────────────────────

const INTERVAL_MS = 2 * 60 * 1000;
const AUTO_HIDE_MS = 15000;

type Ad = (typeof ADS)[number];

function linkLabel(ad: Ad, en: boolean) {
  const instagram = ad.link.includes("instagram");
  if (en) return instagram ? "Follow on Instagram" : "Shop on Shopee";
  return instagram ? "ติดตามบน Instagram" : "สั่งซื้อที่ Shopee";
}

/** Exhibition-placard styled merch card: dark glass, gold hairline, serif title. */
export default function MerchPopup() {
  const en = useLocale() === "en";
  const [visible, setVisible] = useState(false);
  const [ad, setAd] = useState(ADS[0]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pickRandom(current: Ad) {
    const pool = ADS.filter((a) => a.image !== current.image);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function show() {
    setAd((cur) => pickRandom(cur));
    setVisible(true);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      schedule();
    }, AUTO_HIDE_MS);
  }

  function schedule() {
    showTimer.current = setTimeout(show, INTERVAL_MS);
  }

  function dismiss() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(false);
    schedule();
  }

  useEffect(() => {
    const first = setTimeout(show, 1200);
    return () => {
      clearTimeout(first);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (showTimer.current) clearTimeout(showTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  const desc = en ? ad.descEn : ad.desc;

  return (
    <aside
      key={ad.image}
      aria-label={ad.tag}
      className="merch-popup fixed top-16 right-4 sm:top-auto sm:bottom-6 sm:right-6 z-50 flex items-stretch overflow-hidden"
      style={{
        width: "min(380px, calc(100vw - 2rem))",
        background: "linear-gradient(135deg, rgba(14,18,30,.82), rgba(6,8,14,.9))",
        backdropFilter: "blur(16px) saturate(1.2)",
        WebkitBackdropFilter: "blur(16px) saturate(1.2)",
        border: "1px solid rgba(212,168,67,.22)",
        borderRadius: 4,
        boxShadow: "0 24px 60px rgba(0,0,0,.55), 0 0 40px rgba(47,141,255,.08)",
        animation: "merch-in .7s cubic-bezier(.22,1,.36,1) both",
      }}
    >
      {/* Artwork-style image with a thin inner frame */}
      <div className="relative w-24 sm:w-32 shrink-0 m-2.5 mr-0 overflow-hidden" style={{ borderRadius: 2, outline: "1px solid rgba(212,168,67,.25)", outlineOffset: -1 }}>
        <Image src={ad.image} alt={ad.title} fill className="object-cover object-center" sizes="128px" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 60%,rgba(3,5,11,.45))" }} />
      </div>

      <div className="flex flex-col justify-between px-4 py-3.5 flex-1 min-w-0">
        <div>
          <p lang="en" className="text-[10px] tracking-[.28em] uppercase text-gold mb-1.5 flex items-center gap-2">
            <span className="inline-block h-px w-4 bg-gold/70" />
            {ad.tag}
          </p>
          <h3 className="font-serif text-lg sm:text-xl leading-tight text-ink mb-1">{ad.title}</h3>
          <p className="hidden sm:block text-ink2 text-xs leading-relaxed">
            {desc.split("\n").map((line, i, all) => (
              <span key={i}>
                {line}
                {i < all.length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>

        <a
          href={ad.link}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-3 inline-flex items-center justify-between gap-2 border-t pt-2.5 text-[11px] tracking-[.14em] uppercase text-gold-light transition-colors hover:text-white"
          style={{ borderColor: "rgba(212,168,67,.18)" }}
        >
          {linkLabel(ad, en)}
          <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden>↗</span>
        </a>
      </div>

      <button
        onClick={dismiss}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full text-ink3 hover:text-gold-light transition-colors"
        aria-label={en ? "Close" : "ปิด"}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden>
          <path d="M9 1 5 5l4 4-1 1-4-4-4 4-1-1 4-4-4-4 1-1 4 4 4-4z" />
        </svg>
      </button>

      {/* Time left before it tucks itself away */}
      <span
        className="absolute bottom-0 left-0 h-px bg-gold/60 origin-left"
        style={{ width: "100%", animation: `merch-timer ${AUTO_HIDE_MS}ms linear both` }}
        aria-hidden
      />

      <style>{`
        @keyframes merch-in {
          from { opacity: 0; transform: translateY(14px); filter: blur(6px); }
          to   { opacity: 1; transform: none; filter: none; }
        }
        @keyframes merch-timer {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .merch-popup, .merch-popup * { animation: none !important; }
        }
      `}</style>
    </aside>
  );
}
