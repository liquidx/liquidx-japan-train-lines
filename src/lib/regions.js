// Prefecture codes (2-digit ISO) per region, used together with
// static/prefecture-polygons.json for accurate containment testing.
// Bounds are the enclosing rectangle used for the SVG viewport.
// Order: All Japan first, then regions northeast → southwest.
export const regions = [
  { id: "japan", name: "All Japan", nameJa: "全国" },
  {
    id: "hokkaido",
    name: "Hokkaido",
    nameJa: "北海道",
    bounds: { min_lng: 139.30, max_lng: 145.90, min_lat: 41.30, max_lat: 45.60 },
    prefectures: ["01"],
  },
  {
    id: "tohoku",
    name: "Tohoku",
    nameJa: "東北",
    prefectures: ["02", "03", "04", "05", "06", "07"], // Aomori Iwate Miyagi Akita Yamagata Fukushima
  },
  {
    id: "kanto",
    name: "Kanto",
    nameJa: "関東",
    prefectures: ["08", "09", "10", "11", "12", "13", "14"], // Ibaraki Tochigi Gunma Saitama Chiba Tokyo Kanagawa
  },
  {
    id: "tokyo",
    name: "Tokyo",
    nameJa: "東京",
    prefectures: ["13"], // Tokyo
  },
  {
    id: "chubu",
    name: "Chubu",
    nameJa: "中部",
    prefectures: ["15", "16", "17", "18", "19", "20", "21", "22", "23"], // Gifu Shizuoka Aichi Niigata Toyama Ishikawa Fukui Yamanashi Nagano
  },
  {
    id: "kansai",
    name: "Kansai",
    nameJa: "関西",
    prefectures: ["24", "25", "26", "27", "28", "29", "30"], // Mie Shiga Kyoto Osaka Hyogo Nara Wakayama
  },
  {
    id: "chugoku",
    name: "Chugoku",
    nameJa: "中国",
    prefectures: ["31", "32", "33", "34", "35"], // Tottori Shimane Okayama Hiroshima Yamaguchi
  },
  {
    id: "shikoku",
    name: "Shikoku",
    nameJa: "四国",
    prefectures: ["36", "37", "38", "39"], // Tokushima Kagawa Ehime Kochi
  },
  {
    id: "kyushu",
    name: "Kyushu",
    nameJa: "九州",
    prefectures: ["40", "41", "42", "43", "44", "45", "46"], // Fukuoka Saga Nagasaki Kumamoto Oita Miyazaki Kagoshima
  },
  {
    id: "okinawa",
    name: "Okinawa",
    nameJa: "沖縄",
    prefectures: ["47"],
  },
];
