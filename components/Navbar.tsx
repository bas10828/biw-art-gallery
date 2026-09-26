"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { alternatePath, localizePath } from "@/lib/i18n";
import { useT } from "@/lib/useLocale";
import SoundToggle from "@/components/gallery/SoundToggle";

export default function Navbar({ onOpenIndex }: { onOpenIndex?: () => void }) {
  const { locale, t } = useT();
  const pathname = usePathname() || "/";
  const otherLocale = locale === "th" ? "en" : "th";

  return (
    <nav
      className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4"
      style={{ background: "linear-gradient(180deg,rgba(3,5,11,.85) 0%,rgba(3,5,11,0) 100%)" }}
    >
      <Link href={localizePath("/", locale)} className="flex items-center flex-shrink-0">
        <Image
          src="/images/logo-khodseaw.png"
          alt="Biw Art Gallery"
          width={110}
          height={44}
          priority
          className="object-contain"
          style={{ height: 40, width: "auto" }}
        />
      </Link>

      <div className="flex items-center gap-2">
        {onOpenIndex && (
          <button onClick={onOpenIndex} className="nav-pill">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
              <rect x="0" y="0" width="5" height="5" rx="1" />
              <rect x="7" y="0" width="5" height="5" rx="1" />
              <rect x="0" y="7" width="5" height="5" rx="1" />
              <rect x="7" y="7" width="5" height="5" rx="1" />
            </svg>
            <span className="hidden sm:inline">{t.nav.works}</span>
          </button>
        )}
        <SoundToggle />
        <Link
          href={alternatePath(pathname, otherLocale)}
          hrefLang={otherLocale}
          title={otherLocale === "en" ? "English" : "ภาษาไทย"}
          className="nav-pill"
        >
          {t.nav.switchTo}
        </Link>
      </div>
    </nav>
  );
}
