"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import ArtModal from "@/components/ArtModal";
import Footer from "@/components/Footer";
import IndexOverlay from "@/components/gallery/IndexOverlay";
import ArtistModal from "@/components/gallery/ArtistModal";
import { ARTIST_PORTRAIT, TOUR, type Artwork } from "@/lib/artworks";
import { SITE_URL } from "@/lib/i18n";
import { tourState } from "@/lib/gallery/tourState";
import { useT } from "@/lib/useLocale";

const GalleryStage = dynamic(() => import("@/components/gallery/GalleryStage"), { ssr: false });

const N = TOUR.length;
/** Section indexes: 0 entrance, 1..N works, then the artist's wall, then the exit. */
const ARTIST_STOP = N + 1;
const EXIT_STOP = N + 2;
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
  const [artistOpen, setArtistOpen] = useState(false);
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
      const a = Math.round(Math.min(p, EXIT_STOP));
      setActive(a);
      // Lets CSS hide overlays (the merch popup) on small screens mid-tour.
      document.documentElement.dataset.tour = a >= 1 && a <= ARTIST_STOP ? "on" : "off";
      setPaused(p > EXIT_STOP + 0.9);
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, p / EXIT_STOP)})`;
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

  // In 3D the page jumps and the camera walks there at its own pace;
  // without 3D the page itself scrolls smoothly.
  const goTo = useCallback(
    (section: number) => {
      const el = sections.current[Math.max(0, Math.min(EXIT_STOP, section))];
      if (!el) return;
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY,
        behavior: mode === "3d" ? "instant" : "smooth",
      });
    },
    [mode]
  );

  const activeRef = useRef(0);
  activeRef.current = active;
  const overlayOpen = !!selected || indexOpen || artistOpen;

  // Step through the works: arrow keys, and horizontal swipes on touch screens.
  useEffect(() => {
    if (overlayOpen) return;
    const step = (delta: number) => {
      if (activeRef.current > ARTIST_STOP) return;
      goTo(activeRef.current + delta);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else return;
      e.preventDefault();
    };
    let start: { x: number; y: number } | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      start = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [goTo, overlayOpen]);

  const openFromScene = useCallback((index: number) => {
    if (index < N) setSelected(TOUR[index]);
    else setArtistOpen(true); // the portrait on the artist's wall
  }, []);
  const closeModal = useCallback(() => setSelected(null), []);
  const closeIndex = useCallback(() => setIndexOpen(false), []);
  const closeArtist = useCallback(() => setArtistOpen(false), []);

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
  const nextLabel =
    active === 0 ? t.tour.start : active === N ? t.tour.toArtist : active === ARTIST_STOP ? t.tour.finish : t.tour.next;

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
          <GalleryStage loadingLabel={t.tour.loading} onSelect={openFromScene} paused={paused || overlayOpen} />
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

        {/* The artist's wall — last stop in the room */}
        <section
          id="artist"
          ref={(el) => {
            sections.current[ARTIST_STOP] = el;
          }}
          aria-labelledby="artist-title"
          className={is2d ? "tour-section-flat" : "tour-section"}
        >
          <article className="tour-card pointer-events-auto">
            {is2d && (
              <div className="relative mb-6 aspect-[4/3] w-full overflow-hidden rounded-sm">
                <Image src={`/images/${ARTIST_PORTRAIT.file}`} alt={t.about.realName} fill className="object-cover" sizes="640px" />
              </div>
            )}
            <p className="mb-4 text-[11px] tracking-[.25em] uppercase text-gold">{t.about.badge}</p>
            <h2 id="artist-title" className="tour-title">
              {t.about.name}
            </h2>
            <p className="mt-2 font-serif text-sm italic text-ink2 sm:text-base">{t.about.realName}</p>
            <div className="tour-meta mt-4 h-0 py-0" />
            <p className="tour-excerpt mt-4 text-sm leading-relaxed text-ink/80">{t.about.short}</p>
            <button
              onClick={() => setArtistOpen(true)}
              className="group mt-5 inline-flex items-center gap-2 text-xs tracking-[.2em] uppercase text-gold transition-colors hover:text-gold-light"
            >
              {t.tour.readBio}
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </button>
          </article>
        </section>

        {/* Exit: the camera rises over the tree */}
        <section
          ref={(el) => {
            sections.current[EXIT_STOP] = el;
          }}
          className="exit-section pointer-events-auto relative flex min-h-svh flex-col justify-end"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-16 text-center">
            <p className="font-serif text-xl leading-relaxed text-ink sm:text-2xl">“{t.about.bio3}”</p>
            <p className="mt-4 text-[11px] tracking-[.3em] uppercase text-gold">— {t.about.realName}</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="mt-12 text-[11px] tracking-[.3em] uppercase text-ink3 transition-colors hover:text-gold-light"
            >
              ↑ {t.tour.backToTop}
            </button>
          </div>
          <Footer />
        </section>
      </main>

      {/* Step controls */}
      {active <= ARTIST_STOP && (
        <nav aria-label={t.tour.indexTitle} className="step-nav fixed z-40 flex items-center gap-2">
          {active >= 1 && (
            <button onClick={() => goTo(active - 1)} className="nav-pill step-btn" aria-label={t.tour.prev}>
              <span aria-hidden>←</span>
              <span className="hidden wide:inline">{t.tour.prev}</span>
            </button>
          )}
          {active >= 1 && active <= N && (
            <span lang="en" className="min-w-[4.5rem] text-center text-[11px] tracking-[.2em] text-ink2">
              <span className="text-gold">{pad(active)}</span> / {pad(N)}
            </span>
          )}
          <button
            onClick={() => goTo(active + 1)}
            className="nav-pill step-btn step-next"
            aria-label={nextLabel}
          >
            <span className={active === 0 || active >= N ? "" : "hidden wide:inline"}>{nextLabel}</span>
            <span aria-hidden>→</span>
          </button>
        </nav>
      )}

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
      <ArtistModal open={artistOpen} onClose={closeArtist} />
    </>
  );
}
