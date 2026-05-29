"use client";
import { useState } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import ArtModal from "@/components/ArtModal";
import Footer from "@/components/Footer";
import { ARTWORKS, type Artwork } from "@/lib/artworks";

export default function GalleryPage() {
  const [selected, setSelected] = useState<Artwork | null>(null);

  return (
    <>
      <Navbar />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center pt-40 pb-20 px-6 overflow-hidden">
        {/* Background image */}
        <Image
          src="/images/exhibition-trees.png"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        {/* Dark overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.72) 0%, rgba(0,0,0,.55) 60%, rgba(0,0,0,.85) 100%)" }}
        />
        <span
          className="relative inline-block text-gold text-xs tracking-[.2em] uppercase border rounded-full px-4 py-1.5 mb-5"
          style={{ borderColor: "rgba(212,168,67,.2)" }}
        >
          khodseaw
        </span>
        <h1
          className="relative font-bold leading-tight mb-4"
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "clamp(2.5rem,6vw,4.5rem)",
            background: "linear-gradient(135deg,#ffffff 30%,var(--color-gold-light) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Biw Art Gallery
        </h1>
        <p className="relative text-white/70 font-light max-w-md leading-relaxed">
          ไม่ใช่ศิลปะเพื่อความสวยงาม<br />
          มันคือแรงกระแทกในหัวใจ<br />
          เสียงของเลือดที่กำลังเดือดปะทุอยู่ข้างใน
        </p>
        <div
          className="relative w-16 h-px mt-10"
          style={{
            background: "linear-gradient(90deg,transparent,var(--color-gold),transparent)",
          }}
        />
      </section>

      {/* Gallery Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
          {ARTWORKS.map((art, i) => (
            <div
              key={art.id}
              onClick={() => setSelected(art)}
              className="group cursor-pointer rounded-xl overflow-hidden border transition-all duration-300 hover:-translate-y-1.5"
              style={{
                background: "var(--color-bg3)",
                borderColor: "rgba(212,168,67,.12)",
                animationDelay: `${i * 0.07}s`,
                boxShadow: "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,168,67,.4)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,.5)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(212,168,67,.12)";
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={`/images/${art.file}`}
                  alt={art.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  sizes="(max-width:640px) 100vw,(max-width:1024px) 50vw,33vw"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/35 transition-all duration-300">
                  <span className="text-gold-light text-2xl opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                    ✦
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-ink mb-1" style={{ fontFamily: "var(--font-serif)" }}>
                  {art.title}
                </h3>
                <p className="text-xs text-ink2">
                  {art.titleEn} · {art.year}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />

      {selected && <ArtModal art={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
