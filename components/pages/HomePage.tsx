"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import ArtModal from "@/components/ArtModal";
import Footer from "@/components/Footer";
import IndexOverlay from "@/components/gallery/IndexOverlay";
import { TOUR, type Artwork } from "@/lib/artworks";
import { SITE_URL } from "@/lib/i18n";
import { tourState } from "@/lib/gallery/tourState";
import { useT } from "@/lib/useLocale";

const GalleryStage = dynamic(() => import("@/components/gallery/GalleryStage"), { ssr: false });

const N = TOUR.length;
const NEWEST_ID = Math.max(...TOUR.filter((a) => !a.featured).map((a) => a.id));
const pad = (n: number) => String(n).padStart(2, "0");

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function HomePage() {
  const { locale, t } = useT();
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [mode, setMode] = useState<"pending" | "3d" | "2d">("pending");
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const sections = useRef<(HTMLElement | null)[]>([]);
  const tops = useRef<number[]>([]);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => setMode(supportsWebGL() ? "3d" : "2d"), []);

  // Scroll position -> tour progress (0 entrance, 1..N paintings, N+1 exit).
  useEffect(() => {
    const measure = () => {
      tops.current = sections.current.map((el) =>
        el ? el.getBoundingClientRect().top + window.scrollY : 0
      );
    };
    const update = () => {
      const y = window.scrollY;
      const ts = tops.current;
      let p = 0;
      for (let i = 0; i < ts.length - 1; i++) {
        if (y >= ts[i]) p = i + Math.min(1, (y - ts[i]) / Math.max(1, ts[i + 1] - ts[i]));
      }
      const last = ts.length - 1;
      if (y > ts[last]) p = last + (y - ts[last]) / window.innerHeight;
      tourState.progress = p;
      const a = Math.round(Math.min(p, N + 1));
      setActive(a);
      // Lets CSS hide overlays (the merch popup) on small screens mid-tour.
      document.documentElement.dataset.tour = a >= 1 && a <= N ? "on" : "off";
      setPaused(p > N + 1.8);
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, p / (N + 1))})`;
    };
    const onPointer = (e: PointerEvent) => {
      tourState.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      tourState.pointerY = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    measure();
    update();
    const ro = new ResizeObserver(() => {
      measure();
      update();
    });
    ro.observe(document.body);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("pointermove", onPointer);
      delete document.documentElement.dataset.tour;
    };
  }, [mode]);

  const goTo = useCallback((section: number) => {
    const el = sections.current[section];
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: "smooth" });
  }, []);

  const openFromScene = useCallback((index: number) => setSelected(TOUR[index]), []);
  const closeModal = useCallback(() => setSelected(null), []);
  const closeIndex = useCallback(() => setIndexOpen(false), []);

  const artist = {
    "@type": "Person",
    name: locale === "en" ? "Aksonwichit Hongtan" : "อักษรวิจิตร หงษ์ตัน",
    alternateName: ["บิว โคตรเสียว", "บิวโคตรเสียว", "khodseaw", "Biw"],
    jobTitle: locale === "en" ? "Painter" : "จิตรกร",
    nationality: "Thai",
    description: t.about.short,
    sameAs: ["https://www.instagram.com/khotseaw._", "https://www.facebook.com/khotseaw05"],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ArtGallery",
    name: "Biw Art Gallery",
    description: t.about.short,
    url: locale === "en" ? `${SITE_URL}/en` : SITE_URL,
    inLanguage: locale,
    creator: artist,
    hasPart: TOUR.map((a) => ({
      "@type": "VisualArtwork",
      name: locale === "en" ? a.titleEn : a.title,
      alternateName: locale === "en" ? a.title : a.titleEn,
      image: `${SITE_URL}/images/${a.file}`,
      artform: "Painting",
      artMedium: a.medium,
      artworkSurface: "Canvas",
      dateCreated: a.year,
      ...(a.size ? { size: a.size } : {}),
      abstract: (locale === "en" ? a.storyEn : a.story).replace(/\n\n/g, " "),
    })),
  };

  const is2d = mode === "2d";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Navbar onOpenIndex={() => setIndexOpen(true)} />

      {/* Tour progress */}
      <div className="fixed inset-x-0 top-0 z-[60] h-[2px] bg-white/5">
        <div ref={bar} className="h-full origin-left bg-gold" style={{ transform: "scaleX(0)" }} />
      </div>

      {mode === "3d" && (
        <>
          <GalleryStage loadingLabel={t.tour.loading} onSelect={openFromScene} paused={paused || !!selected} />
          <div className="stage-scrim pointer-events-none fixed inset-0 z-[1]" aria-hidden />
        </>
      )}

      {/* Desktop rail */}
      {!is2d && (
        <nav
          aria-label={t.tour.indexTitle}
          className="tour-rail fixed right-5 top-1/2 z-40 -translate-y-1/2 flex-col items-end gap-[7px]"
          style={{ opacity: active >= 1 && active <= N ? 1 : 0 }}
        >
          {TOUR.map((a, i) => (
            <button
              key={a.id}
              onClick={() => goTo(i + 1)}
              aria-label={locale === "en" ? a.titleEn : a.title}
              aria-current={active === i + 1}
              className="group flex items-center gap-3 py-[3px]"
            >
              <span
                lang="en"
                className="text-[10px] tracking-[.15em] text-gold-light transition-opacity duration-300"
                style={{ opacity: active === i + 1 ? 1 : 0 }}
              >
                {pad(i + 1)}
              </span>
              <span
                className="block h-px bg-current transition-all duration-500 group-hover:w-6 group-hover:text-gold-light"
                style={{
                  width: active === i + 1 ? 28 : 12,
                  color: active === i + 1 ? "var(--color-gold)" : "rgba(240,235,224,.35)",
                }}
              />
            </button>
          ))}
        </nav>
      )}

      <main className={`relative z-10 ${is2d ? "" : "pointer-events-none"}`}>
        {/* Entrance */}
        <section
          ref={(el) => {
            sections.current[0] = el;
          }}
          className="hero-veil relative isolate flex h-svh flex-col items-center justify-end px-6 pb-[13svh] text-center"
        >
          <p className="hero-rise mb-5 text-[11px] tracking-[.35em] uppercase text-gold" style={{ animationDelay: ".1s" }}>
            <span lang="en">{t.hero.badge}</span> <span className="text-ink3">—</span> {t.hero.exhibition}
          </p>
          <h1 className="hero-title hero-rise" style={{ animationDelay: ".25s" }}>
            Biw Art <em>Gallery</em>
          </h1>
          <p className="hero-rise mt-6 max-w-md text-sm font-light leading-relaxed text-ink/75 sm:text-base" style={{ animationDelay: ".45s" }}>
            {t.hero.line1}
            <br />
            {t.hero.line2}
            <br />
            {t.hero.line3}
          </p>
          <button
            onClick={() => goTo(1)}
            className="hero-rise pointer-events-auto mt-10 flex flex-col items-center gap-3 text-[11px] tracking-[.3em] uppercase text-ink2 transition-colors hover:text-gold-light"
            style={{ animationDelay: ".7s" }}
          >
            {t.hero.enter}
            <span className="scroll-cue" aria-hidden />
          </button>
        </section>

        {/* One section per painting */}
        {TOUR.map((art, i) => {
          const title = locale === "en" ? art.titleEn : art.title;
          const alt = locale === "en" ? art.title : art.titleEn;
          const story = (locale === "en" ? art.storyEn : art.story).split("\n\n");
          const badge = art.featured ? t.featured.eyebrow : art.id === NEWEST_ID ? t.tour.newWork : null;
          return (
            <section
              key={art.id}
              id={`work-${art.id}`}
              ref={(el) => {
                sections.current[i + 1] = el;
              }}
              aria-labelledby={`work-${art.id}-title`}
              className={is2d ? "tour-section-flat" : "tour-section"}
            >
              <article className="tour-card pointer-events-auto">
                {is2d && (
                  <button onClick={() => setSelected(art)} className="mb-6 block w-full overflow-hidden rounded-sm">
                    <Image
                      src={`/images/${art.file}`}
                      alt={title}
                      width={900}
                      height={Math.round(900 / art.ratio)}
                      sizes="(max-width:768px) 100vw, 640px"
                      className="h-auto w-full"
                    />
                  </button>
                )}
                <p className="mb-4 flex items-center gap-3 text-[11px] tracking-[.25em] uppercase">
                  <span lang="en" className="text-gold">No. {pad(i + 1)}</span>
                  <span lang="en" className="text-ink3">/ {pad(N)}</span>
                  {badge && (
                    <span className="rounded-full border border-gold/40 px-2.5 py-0.5 text-[9px] tracking-[.2em] text-gold-light">
                      {badge}
                    </span>
                  )}
                </p>
                <h2 id={`work-${art.id}-title`} className="tour-title">
                  {title}
                </h2>
                <p className="mt-2 font-serif text-sm italic text-ink2 sm:text-base">{alt}</p>
                <p lang="en" className="tour-meta mt-4 py-3 text-[11px] tracking-[.12em] uppercase text-ink3">
                  {art.medium}
                  {art.size ? ` · ${art.size}` : ""} · {art.year}
                </p>
                <p className="tour-excerpt mt-4 text-sm leading-relaxed text-ink/80">{story[0]}</p>
                <button
                  onClick={() => setSelected(art)}
                  className="group mt-5 inline-flex items-center gap-2 text-xs tracking-[.2em] uppercase text-gold transition-colors hover:text-gold-light"
                >
                  {t.featured.cta}
                  <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </button>
              </article>
            </section>
          );
        })}

        {/* About the Artist */}
        <section
          ref={(el) => {
            sections.current[N + 1] = el;
          }}
          className="about-section pointer-events-auto relative"
        >
          <div className="mx-auto max-w-6xl px-5 pb-24 pt-[28svh] sm:px-8">
            <div className="grid items-center gap-10 md:grid-cols-[1fr_1.1fr] md:gap-16">
              <div className="relative aspect-[4/5] overflow-hidden rounded-sm md:aspect-[4/5]">
                <Image
                  src="/images/artist-gallery.png"
                  alt={`${t.about.realName} (${t.about.name})`}
                  fill
                  className="object-cover"
                  sizes="(max-width:768px) 100vw, 45vw"
                />
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,transparent 55%,rgba(3,5,11,.7))" }} />
              </div>
              <div>
                <p className="mb-5 text-[11px] tracking-[.3em] uppercase text-gold">{t.about.badge}</p>
                <h2 className="tour-title">{t.about.name}</h2>
                <p className="mt-2 font-serif text-base italic text-ink2">{t.about.realName}</p>
                <div className="my-7 h-px w-12 bg-gold/60" />
                <p className="text-base leading-relaxed text-ink/85">{t.about.short}</p>
              </div>
            </div>

            <article className="mx-auto mt-16 flex max-w-3xl flex-col gap-6 leading-loose text-ink2 sm:mt-24">
              <p>{t.about.bio1}</p>
              <p>{t.about.bio2}</p>
              <p className="font-serif text-lg leading-relaxed text-ink sm:text-xl">{t.about.bio3}</p>
            </article>

            <div className="mt-16 flex justify-center">
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="text-[11px] tracking-[.3em] uppercase text-ink3 transition-colors hover:text-gold-light"
              >
                ↑ {t.tour.backToTop}
              </button>
            </div>
          </div>
          <Footer />
        </section>
      </main>

      {indexOpen && (
        <IndexOverlay
          works={TOUR}
          onClose={closeIndex}
          onPick={(i) => {
            setIndexOpen(false);
            requestAnimationFrame(() => goTo(i + 1));
          }}
        />
      )}
      {selected && <ArtModal art={selected} onClose={closeModal} />}
    </>
  );
}
