export interface Artwork {
  id: number;
  file: string;
  title: string;
  titleEn: string;
  year: string;
  medium: string;
  story: string;
  storyEn: string;
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
];
