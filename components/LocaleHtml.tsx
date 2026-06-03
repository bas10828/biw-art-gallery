"use client";
import { useEffect } from "react";
import { useLocale } from "@/lib/useLocale";

/**
 * Sets <html lang> on the client to match the current locale.
 * The root layout renders <html lang="th"> statically (no middleware to
 * detect locale server-side); this corrects it for /en routes.
 */
export default function LocaleHtml() {
  const locale = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
