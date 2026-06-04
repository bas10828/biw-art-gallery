export interface Artwork {
  id: number;
  file: string;
  title: string;
  titleEn: string;
  year: string;
  medium: string;
  story: string;
  storyEn: string;
  /** Optional physical dimensions, e.g. "130 × 200 cm". */
  size?: string;
  /** Highlight piece: shown in the featured section, excluded from the grid. */
  featured?: boolean;
}

export const ARTWORKS: Artwork[] = [
  {
    id: 1,
    file: "forest-moon-jellyfish.jpg",
    title: "ดวงจันทร์แห่งป่า",
    titleEn: "Moon of the Forest",
    year: "2024",
    medium: "Acrylic on Canvas",
    story:
      "ดวงจันทร์ไม่อยู่บนฟ้าอีกแล้ว มันจมลงมาอยู่ที่นี่ ท่ามกลางรากไม้และแมงกะพรุนที่ลอยราวกับความฝัน — มันสวยอย่างน่าหวาดกลัว",
    storyEn:
      "The moon no longer hangs in the sky. It has sunk down to here, among the roots and the jellyfish that drift like a dream — beautiful in a way that frightens.",
  },
  {
    id: 2,
    file: "forest-spirits.jpg",
    title: "วิญญาณป่า",
    titleEn: "Forest Spirits",
    year: "2024",
    medium: "Acrylic on Canvas",
    story:
      "สิ่งที่ว่ายอยู่ในความมืดนั้นไม่ใช่แค่แมลง มันคือความรู้สึกที่ไม่มีชื่อ หิ่งห้อยที่ไม่ยอมดับ",
    storyEn:
      "What swims through the darkness is not merely insects. It is a feeling with no name — a firefly that refuses to go out.",
  },
  {
    id: 3,
    file: "jellyfish-forest.jpg",
    title: "แมงกะพรุน",
    titleEn: "Jellyfish",
    year: "2023",
    medium: "Acrylic on Canvas",
    story:
      "บางสิ่งไม่ควรมีอยู่ในป่า — แต่มันก็อยู่ที่นั่น เรืองแสงอย่างไม่ขอโทษใคร",
    storyEn:
      "Some things have no place in a forest — yet there it is, glowing without apology.",
  },
  {
    id: 4,
    file: "bamboo-forest-light.jpg",
    title: "แสงแห่งไผ่",
    titleEn: "Bamboo Light",
    year: "2024",
    medium: "Acrylic on Canvas",
    story:
      "ป่าไม่ต้องการดวงอาทิตย์ เพราะแสงมันออกมาจากข้างใน เสมอ",
    storyEn:
      "The forest has no need of the sun. Its light has always come from within.",
  },
  {
    id: 5,
    file: "ancient-tree.jpg",
    title: "ต้นไม้โบราณ",
    titleEn: "Ancient Tree",
    year: "2026",
    medium: "Acrylic on Canvas",
    story:
      "รากมันเดินทางต่อ ลึกลงไปในที่ที่ไม่มีแสง ไม่มีชื่อ แต่มันยังอยู่",
    storyEn:
      "Its roots travel on, deep into places with no light and no name — and still it endures.",
  },
  {
    id: 6,
    file: "firefly-forest.jpg",
    title: "ป่าหิ่งห้อย",
    titleEn: "Firefly Forest",
    year: "2025",
    medium: "Acrylic on Canvas",
    story:
      "เมื่อป่ามืดพอ ดาวก็เกิดขึ้นเองจากพื้นดิน — ไม่ต้องรอฟ้า",
    storyEn:
      "When the forest grows dark enough, stars rise from the ground itself — no need to wait for the sky.",
  },
  {
    id: 7,
    file: "orca-road.jpg",
    title: "วาฬบนถนน",
    titleEn: "Orca on the Road",
    year: "2025",
    medium: "Acrylic on Canvas",
    story:
      "ทะเลไม่ได้หายไปไหน มันแค่ย้ายที่อยู่ มาอยู่ตรงหน้าเรา อยู่บนถนนที่เราเดินทุกวัน",
    storyEn:
      "The sea never went anywhere. It only moved — to right before us, onto the road we walk every day.",
  },
  {
    id: 8,
    file: "eye-storm.jpg",
    title: "สายตาในพายุ",
    titleEn: "Eye in the Storm",
    year: "2026",
    medium: "Acrylic on Canvas",
    story:
      "มันมองกลับ เสมอ ฟ้าแลบเป็นแค่แสงไฟที่มันใช้ส่องหาเรา",
    storyEn:
      "It always looks back. The lightning is only the lamp it uses to find us.",
  },
  {
    id: 9,
    file: "sunflower-eye.jpg",
    title: "ดอกทานตะวันแห่งสายตา",
    titleEn: "Sunflower Eye",
    year: "2026",
    medium: "Acrylic on Canvas",
    story:
      "ดอกไม้บาน แต่ตรงกลางมันเป็นดวงตา และดวงตาก็จ้องมองโดยไม่กระพริบ",
    storyEn:
      "The flower blooms, but at its center is an eye — and the eye stares without ever blinking.",
  },
  {
    id: 10,
    file: "dream-forest.jpg",
    title: "ป่าในฝัน",
    titleEn: "Dream Forest",
    year: "2026",
    medium: "Acrylic on Canvas",
    story:
      "ในโลกที่ปลามีปีก เมฆหยดน้ำ และหอยมุกโตในทุ่งหญ้า — ใครบอกว่าฝันไม่ใช่ความจริง",
    storyEn:
      "In a world where fish have wings, clouds drip water, and pearl-shells grow in the meadows — who said dreams aren't real?",
  },
  {
    id: 11,
    file: "blue-tree-3.jpg",
    title: "ต้นไม้สีน้ำเงิน III",
    titleEn: "Blue Tree III",
    year: "2026",
    medium: "Acrylic on Canvas",
    story:
      "รากแผ่ออกไปจนไม่รู้สิ้นสุด ต้นมันยืนอยู่เพียงลำพัง แต่ไม่เคยโดดเดี่ยว",
    storyEn:
      "The roots spread out without end. The tree stands alone, yet is never lonely.",
  },
  {
    id: 12,
    file: "blue-tree-horizontal.jpg",
    title: "ต้นไม้สีน้ำเงิน",
    titleEn: "Blue Tree",
    year: "2024",
    medium: "Acrylic on Canvas",
    story:
      "ต้นแรก สีน้ำเงินที่ไม่ใช่แค่สี — มันคือความรู้สึกที่ยังไม่มีชื่อ",
    storyEn:
      "The first one. A blue that is more than a color — a feeling that has yet to be named.",
  },
  {
    id: 13,
    file: "creature-pink-framed.jpg",
    title: "สิ่งมีชีวิต",
    titleEn: "Creature",
    year: "2026",
    medium: "Acrylic on Canvas",
    story:
      "มันไม่ใช่พืช ไม่ใช่สัตว์ ไม่ใช่สิ่งที่ควรมีอยู่ — แต่มันก็อยู่ที่นี่ พร้อมกับดวงตาที่ใหญ่กว่าที่ควร",
    storyEn:
      "Not a plant, not an animal, not a thing that ought to exist — yet here it is, with eyes larger than they should be.",
  },
  {
    id: 14,
    file: "creature-white-framed.jpg",
    title: "สิ่งมีชีวิต II",
    titleEn: "Creature II",
    year: "2026",
    medium: "Acrylic on Canvas",
    story:
      "ตระกูลเดียวกัน โลกเดียวกัน แต่คนละความรู้สึก",
    storyEn:
      "Same kin, same world — a different feeling.",
  },
  {
    id: 15,
    file: "voices-of-the-wilderness.jpg",
    title: "เสียงพูดคุยแห่งพงไพร",
    titleEn: "Voices of the Wilderness",
    year: "2026",
    medium: "Oil on Canvas",
    size: "130 × 200 cm",
    featured: true,
    story:
      "ก่อนมนุษย์จะมีภาษา ก่อนตัวอักษร หนังสือ หรือบทสนทนาใดๆ โลกได้พูดคุยกับตัวเองมาแล้วนับล้านปี\n\n" +
      "กิ่งก้านที่ทอดยื่นและพันเกี่ยวในผลงานชิ้นนี้ ไม่ใช่เพียงรูปทรงของต้นไม้ หากเป็นเส้นทางของการสื่อสารที่มองไม่เห็น เครือข่ายของการรับรู้ที่เชื่อมโยงทุกชีวิตเข้าไว้ด้วยกัน ในสายตาเรา ป่าอาจเงียบงัน แต่ในความเงียบนั้นกลับเต็มไปด้วยบทสนทนา — ต้นไม้บอกเล่าการเปลี่ยนแปลงของฤดูกาล ส่งสัญญาณถึงภัยคุกคาม แบ่งปันพลังงานและความทรงจำผ่านรากที่หยั่งลึกใต้ผืนดิน\n\n" +
      "เส้นกิ่งสีขาวที่แตกแขนงไปทั่วผืนภาพ คือระบบประสาทขนาดมหึมาของโลก ราวกับป่าทั้งผืนมิได้ประกอบขึ้นจากต้นไม้หลายต้น หากเป็นสิ่งมีชีวิตเดียวที่กำลังคิด กำลังรู้สึก และสนทนากับตัวเองอยู่ตลอดเวลา โทนน้ำเงินเข้มไม่ได้สื่อถึงค่ำคืนเพียงอย่างเดียว แต่เป็นดินแดนระหว่างความจริงกับความฝัน\n\n" +
      "ผลงานชิ้นนี้จึงตั้งคำถามว่า บางทีเราอาจไม่เคยอยู่เหนือธรรมชาติเลย เป็นเพียงอีกหนึ่งเสียงเล็กๆ ในบทสนทนาอันยิ่งใหญ่ของโลก และบางที “ความเงียบของป่า” อาจเป็นเพราะเราลืมวิธีรับฟังภาษาของมันไปแล้ว",
    storyEn:
      "Before humankind had language — before letters, books, or any conversation — the world had already been speaking to itself for millions of years.\n\n" +
      "The branches reaching and intertwining in this work are not merely the shape of trees, but invisible paths of communication, a network of awareness binding every living thing together. To us the forest may seem silent, yet that silence is full of conversation — trees telling of the changing seasons, signaling danger, sharing energy and memory through roots sunk deep in the earth.\n\n" +
      "The white branches spreading across the canvas are the immense nervous system of the world, as if the whole forest were not many trees but a single living being — thinking, feeling, and forever in dialogue with itself. The deep blue speaks not only of nightfall, but of the land between the real and the dreamed.\n\n" +
      "And so the work asks: perhaps we were never above nature, only one small voice in its vast conversation. And perhaps the “silence of the forest” is only because we have forgotten how to listen to its language.",
  },
];
