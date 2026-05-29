export interface Artwork {
  id: number;
  file: string;
  title: string;
  titleEn: string;
  year: string;
  medium: string;
  story: string;
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
  },
];
