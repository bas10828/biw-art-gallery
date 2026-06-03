"use client";
import { useState } from "react";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import ArtModal from "@/components/ArtModal";
import Footer from "@/components/Footer";
import { ARTWORKS, type Artwork } from "@/lib/artworks";
import { SITE_URL } from "@/lib/i18n";
import { useT } from "@/lib/useLocale";

export default function HomePage() {
  const { locale, t } = useT();
  const [selected, setSelected] = useState<Artwork | null>(null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ArtGallery",
    name: "Biw Art Gallery",
    description: t.about.short,
    url: locale === "en" ? `${SITE_URL}/en` : SITE_URL,
    inLanguage: locale,
    creator: {
      "@type": "Person",
      name: locale === "en" ? "Aksonwichit Hongtan" : "อักษรวิจิตร หงษ์ตัน",
      alternateName: ["บิว โคตรเสียว", "บิวโคตรเสียว", "khodseaw", "Biw"],
      jobTitle: locale === "en" ? "Painter" : "จิตรกร",
      nationality: "Thai",
      description: t.about.short,
      sameAs: [
        "https://www.instagram.com/khotseaw._",
        "https://www.facebook.com/khotseaw05",
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center pt-40 pb-20 px-6 overflow-hidden">
        {/* Background image — CSS bg for guaranteed early LCP preload */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/exhibition-trees.webp')" }}
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
          {t.hero.badge}
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
          {t.hero.line1}<br />
          {t.hero.line2}<br />
          {t.hero.line3}
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
                  alt={locale === "en" ? art.titleEn : art.title}
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
                  {locale === "en" ? art.titleEn : art.title}
                </h3>
                <p className="text-xs text-ink2">
                  {(locale === "en" ? art.title : art.titleEn)} · {art.year}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About the Artist */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div
          className="rounded-2xl overflow-hidden border flex flex-col md:flex-row"
          style={{ borderColor: "rgba(212,168,67,.15)", background: "var(--color-bg3)" }}
        >
          {/* Image */}
          <div className="relative w-full md:w-1/2 min-h-72">
            <Image
              src="/images/artist-gallery.png"
              alt={`${t.about.realName} (${t.about.name})`}
              fill
              className="object-cover object-center"
              sizes="(max-width:768px) 100vw, 50vw"
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(to right, transparent 60%, var(--color-bg3))" }}
            />
          </div>

          {/* Text */}
          <div className="flex flex-col justify-center px-8 py-10 md:w-1/2 gap-4">
            <span
              className="text-gold text-xs tracking-[.2em] uppercase border rounded-full px-4 py-1.5 self-start"
              style={{ borderColor: "rgba(212,168,67,.2)" }}
            >
              {t.about.badge}
            </span>
            <h2
              className="font-bold leading-tight"
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.5rem,3vw,2.2rem)",
                background: "linear-gradient(135deg,#ffffff 30%,var(--color-gold-light) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t.about.name}
            </h2>
            <p className="text-ink2 text-sm leading-relaxed" style={{ fontFamily: "var(--font-serif)" }}>
              {t.about.realName}
            </p>
            <div
              className="w-10 h-px"
              style={{ background: "linear-gradient(90deg,var(--color-gold),transparent)" }}
            />
            <p className="text-ink2 text-sm leading-relaxed">{t.about.short}</p>
          </div>
        </div>

        {/* Full bio */}
        <article className="mt-8 flex flex-col gap-5 text-ink2 leading-loose">
          <p>{t.about.bio1}</p>
          <p>{t.about.bio2}</p>
          <p className="text-ink" style={{ fontFamily: "var(--font-serif)" }}>
            {t.about.bio3}
          </p>
        </article>
      </section>

      <Footer />

      {selected && <ArtModal art={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
