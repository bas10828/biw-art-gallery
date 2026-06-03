"use client";
import { usePathname } from "next/navigation";
import { DICT, getLocaleFromPath, type Locale } from "@/lib/i18n";

/** Current locale derived from the URL path. */
export function useLocale(): Locale {
  return getLocaleFromPath(usePathname() || "/");
}

/** Current locale + its dictionary in one call. */
export function useT() {
  const locale = useLocale();
  return { locale, t: DICT[locale] };
}
