"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/useLocale";

const TARGET_VOLUME = 0.55;

/** Opt-in background music. Browsers block autoplay, so it starts off. */
export default function SoundToggle() {
  const { t } = useT();
  const audio = useRef<HTMLAudioElement | null>(null);
  const fade = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(
    () => () => {
      if (fade.current) cancelAnimationFrame(fade.current);
      audio.current?.pause();
    },
    []
  );

  function fadeTo(volume: number, then?: () => void) {
    const el = audio.current;
    if (!el) return;
    if (fade.current) cancelAnimationFrame(fade.current);
    const from = el.volume;
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 900);
      el.volume = from + (volume - from) * k;
      if (k < 1) fade.current = requestAnimationFrame(tick);
      else then?.();
    };
    fade.current = requestAnimationFrame(tick);
  }

  async function toggle() {
    if (!audio.current) {
      audio.current = new Audio("/audio/khodseaw-theme.m4a");
      audio.current.loop = true;
      audio.current.volume = 0;
    }
    const el = audio.current;
    if (playing) {
      setPlaying(false);
      fadeTo(0, () => el.pause());
      return;
    }
    try {
      await el.play();
      setPlaying(true);
      fadeTo(TARGET_VOLUME);
    } catch {
      setPlaying(false);
    }
  }

  const label = playing ? t.nav.soundOff : t.nav.soundOn;

  return (
    <button
      onClick={toggle}
      aria-label={label}
      aria-pressed={playing}
      title={label}
      className="nav-pill w-9 px-0"
    >
      <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-[2px] rounded-full bg-current ${playing ? "sound-bar" : ""}`}
            style={{ height: playing ? undefined : 3, animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </span>
    </button>
  );
}
