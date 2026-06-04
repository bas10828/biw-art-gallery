// Locale data + helpers. No React here so both server (layouts/metadata)
// and client components can import it.

export type Locale = "th" | "en";

export const LOCALES: Locale[] = ["th", "en"];
export const DEFAULT_LOCALE: Locale = "th";

export const SITE_URL = "https://biwkhodseaw.22422522.xyz";

/** Derive locale from a pathname. English lives under /en, Thai is unprefixed. */
export function getLocaleFromPath(path: string): Locale {
  return path === "/en" || path.startsWith("/en/") ? "en" : "th";
}

/** Strip the /en prefix, returning the canonical (Thai) path. */
export function stripLocale(path: string): string {
  if (path === "/en") return "/";
  if (path.startsWith("/en/")) return path.slice(3); // "/en/game" -> "/game"
  return path;
}

/** Build the path for a canonical (Thai) path in the given locale. */
export function localizePath(canonicalPath: string, locale: Locale): string {
  if (locale === "th") return canonicalPath;
  if (canonicalPath === "/") return "/en";
  return "/en" + canonicalPath;
}

/** Given any current path, return the equivalent path in the target locale. */
export function alternatePath(currentPath: string, target: Locale): string {
  return localizePath(stripLocale(currentPath), target);
}

type Dict = {
  nav: {
    miniGames: string;
    logout: string;
    switchTo: string; // label of the language toggle (the OTHER language)
  };
  hero: {
    badge: string;
    line1: string;
    line2: string;
    line3: string;
  };
  about: {
    badge: string;
    name: string;
    realName: string;
    short: string;
    bio1: string;
    bio2: string;
    bio3: string;
  };
  featured: {
    eyebrow: string;
    cta: string;
  };
  modal: {
    eyebrow: string;
  };
  footer: {
    tagline: string;
  };
};

export const DICT: Record<Locale, Dict> = {
  th: {
    nav: {
      miniGames: "Mini Games",
      logout: "ออกจากระบบ",
      switchTo: "EN",
    },
    hero: {
      badge: "khodseaw",
      line1: "ไม่ใช่ศิลปะเพื่อความสวยงาม",
      line2: "มันคือแรงกระแทกในหัวใจ",
      line3: "เสียงของเลือดที่กำลังเดือดปะทุอยู่ข้างใน",
    },
    about: {
      badge: "ศิลปิน",
      name: "บิว โคตรเสียว",
      realName: "อักษรวิจิตร หงษ์ตัน",
      short:
        "ศิลปินร่วมสมัยชาวไทย ผู้สำรวจความสัมพันธ์ระหว่างมนุษย์กับธรรมชาติ ผ่านภาพต้นไม้ ป่าไม้ และภูมิทัศน์ทางอารมณ์ที่กึ่งจริงกึ่งจินตนาการ",
      bio1: "อักษรวิจิตร หงษ์ตัน หรือ “บิวโคตรเสียว” เป็นศิลปินร่วมสมัยชาวไทยที่สำรวจความสัมพันธ์ระหว่างมนุษย์กับธรรมชาติ ผ่านภาพต้นไม้ ป่าไม้ และภูมิทัศน์ทางอารมณ์กึ่งจริงกึ่งจินตนาการ แก่นของงานคือต้นไม้ไร้ใบที่ปรากฏซ้ำเสมอ — ไม่ใช่วัตถุในธรรมชาติ แต่เป็นภาพแทนของชีวิต การเติบโต การสูญเสีย และการดำรงอยู่ท่ามกลางความไม่แน่นอน รากที่หยั่งลึกคือความทรงจำและตัวตน กิ่งก้านที่แตกแขนงคือการเชื่อมโยงกับโลกที่กว้างใหญ่กว่าตนเอง",
      bio2: "ผลงานมักอยู่ในโทนสีน้ำเงินและเฉดสีเย็น สร้างบรรยากาศสงบนิ่ง ลึกลับ และเปี่ยมความรู้สึกทางจิตวิญญาณ ต้นไม้เดียวดาย หิ่งห้อยส่องแสง และพื้นที่ว่างอันกว้างใหญ่ เชื้อเชิญให้ผู้ชมเผชิญหน้ากับความเงียบ ความโดดเดี่ยว และความจริงพื้นฐานของชีวิต — การเปลี่ยนแปลง การจากลา และการยืนหยัดเพียงลำพัง สร้างสรรค์ด้วยสีน้ำมันบนผ้าใบ บางครั้งใช้สีอะคริลิกร่วมด้วย เคลื่อนไหวระหว่าง Landscape, Fantasy และ Emotional Landscape",
      bio3: "สำหรับอักษรวิจิตร ต้นไม้ทุกต้นคือภาพเหมือนของมนุษย์ และป่าทุกผืนคือบทสนทนาระหว่างความโดดเดี่ยวกับการเชื่อมโยง ซึ่งยังคงดำเนินต่อไปอย่างไม่มีที่สิ้นสุด",
    },
    featured: {
      eyebrow: "ผลงานล่าสุด",
      cta: "ดูผลงานเต็ม",
    },
    modal: {
      eyebrow: "✦ Original Artwork",
    },
    footer: {
      tagline: "All artworks by Biw",
    },
  },
  en: {
    nav: {
      miniGames: "Mini Games",
      logout: "Log out",
      switchTo: "ไทย",
    },
    hero: {
      badge: "khodseaw",
      line1: "Not art made to be pretty",
      line2: "it is a blow struck to the heart",
      line3: "the sound of blood boiling within",
    },
    about: {
      badge: "Artist",
      name: "Biw Khodseaw",
      realName: "Aksonwichit Hongtan",
      short:
        "A contemporary Thai artist exploring the relationship between humanity and nature through trees, forests, and emotional landscapes that hover between the real and the imagined.",
      bio1: "Aksonwichit Hongtan, known as “Biw Khodseaw,” is a contemporary Thai artist who explores the relationship between humanity and nature through trees, forests, and emotional landscapes poised between reality and imagination. At the heart of his work is the recurring leafless tree — not an object of nature, but an image of life itself: growth, loss, and existence amid uncertainty. Its deep roots are memory and identity; its branching limbs, the connection to a world larger than oneself.",
      bio2: "His paintings often dwell in blues and cool tones, creating an atmosphere that is calm, mysterious, and deeply spiritual. A solitary tree, glowing fireflies, and vast empty space invite the viewer to face silence, solitude, and the fundamental truths of life — change, parting, and standing alone. They are made in oil on canvas, at times with acrylic, moving between Landscape, Fantasy, and Emotional Landscape.",
      bio3: "For Aksonwichit, every tree is a portrait of a human being, and every forest a dialogue between solitude and connection — one that goes on without end.",
    },
    featured: {
      eyebrow: "Latest Work",
      cta: "View full piece",
    },
    modal: {
      eyebrow: "✦ Original Artwork",
    },
    footer: {
      tagline: "All artworks by Biw",
    },
  },
};
