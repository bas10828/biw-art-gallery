"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";

const IMAGES = [
  "/images/merch-black.jpg",
  "/images/merch-white.jpg",
  "/images/merch-flatlay.jpg",
  "/images/merch-lifestyle-gallery.png",
  "/images/merch-lifestyle-gallery-bw.png",
  "/images/merch-lifestyle-sea.png",
];

const INTERVAL_MS = 2 * 60 * 1000;
const AUTO_HIDE_MS = 15000;

export default function MerchPopup() {
  const [visible, setVisible] = useState(false);
  const [imgSrc, setImgSrc] = useState(IMAGES[0]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pickRandom(current: string) {
    const pool = IMAGES.filter((img) => img !== current);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function show() {
    setImgSrc((cur) => pickRandom(cur));
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
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex items-stretch rounded-2xl overflow-hidden shadow-2xl"
      style={{
        width: "min(400px, calc(100vw - 2rem))",
        background: "var(--color-bg3)",
        border: "1px solid rgba(212,168,67,.25)",
        animation: "merch-slidein .35s cubic-bezier(.22,1,.36,1) both",
      }}
    >
      {/* Left — product image */}
      <div className="relative w-36 shrink-0">
        <Image
          src={imgSrc}
          alt="เสื้อโคตรเสียว"
          fill
          className="object-cover object-center"
          sizes="144px"
        />
      </div>

      {/* Right — info */}
      <div className="flex flex-col justify-between px-4 py-4 flex-1 min-w-0">
        <div>
          <p className="text-gold text-[10px] tracking-[.18em] uppercase mb-1">Merch</p>
          <h3
            className="font-bold leading-tight mb-1"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.25rem",
              background: "linear-gradient(135deg,#fff 30%,var(--color-gold-light) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            โคตรเสียว
          </h3>
          <p className="text-ink2 text-xs leading-relaxed mb-3">
            เสื้อยืด limited · 3 สี<br />
            ดำ · ขาว · น้ำเงิน
          </p>
        </div>

        <a
          href="https://s.shopee.co.th/17ZEn4Vl5"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          style={{
            background: "linear-gradient(135deg,#ee4d2d,#ff7337)",
            color: "#fff",
            boxShadow: "0 4px 14px rgba(238,77,45,.4)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 7H3a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zm-9 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zM7.5 7a4.5 4.5 0 0 1 9 0h-2a2.5 2.5 0 0 0-5 0h-2z"/>
          </svg>
          สั่งซื้อที่ Shopee
        </a>
      </div>

      {/* Close */}
      <button
        onClick={dismiss}
        className="absolute top-2.5 right-2.5 w-6 h-6 flex items-center justify-center rounded-full text-ink3 hover:text-ink transition-colors"
        style={{ background: "rgba(0,0,0,.35)" }}
        aria-label="ปิด"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M9 1 5 5l4 4-1 1-4-4-4 4-1-1 4-4-4-4 1-1 4 4 4-4z"/>
        </svg>
      </button>

      <style>{`
        @keyframes merch-slidein {
          from { opacity: 0; transform: translateX(2rem) translateY(.5rem); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
