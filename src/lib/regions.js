// Prefecture codes (2-digit ISO) per region, used together with
// static/prefecture-polygons.json for accurate containment testing.
// Bounds are the enclosing rectangle used for the SVG viewport.
// Order: All Japan first, then regions northeast → southwest.
export const regions = [
  {
    id: "japan",
    name: "All Japan",
    nameJa: "全国",
    initialView: {
      center: { lat: 36.5, lng: 137.5 }, // Center of Honshu
      zoom: 1,
    },
  },
  {
    id: "hokkaido",
    name: "Hokkaido",
    nameJa: "北海道",
    bounds: { min_lng: 139.30, max_lng: 145.90, min_lat: 41.30, max_lat: 45.60 },
    prefectures: ["01"],
    initialView: {
      center: { lat: 43.5, lng: 142.5 }, // Central Hokkaido, near Asahikawa
      zoom: 1,
    },
  },
  {
    id: "tohoku",
    name: "Tohoku",
    nameJa: "東北",
    prefectures: ["02", "03", "04", "05", "06", "07"], // Aomori Iwate Miyagi Akita Yamagata Fukushima
    initialView: {
      center: { lat: 39.2, lng: 141.0 }, // Central Tohoku, near Morioka
      zoom: 1,
    },
  },
  {
    id: "kanto",
    name: "Kanto",
    nameJa: "関東",
    prefectures: ["08", "09", "10", "11", "12", "13", "14"], // Ibaraki Tochigi Gunma Saitama Chiba Tokyo Kanagawa
    initialView: {
      center: { lat: 35.68, lng: 139.73 }, // Central Tokyo / Yamanote loop area
      zoom: 3,
    },
  },
  {
    id: "tokyo",
    name: "Tokyo",
    nameJa: "東京",
    prefectures: ["13"], // Tokyo
    initialView: {
      center: { lat: 35.68, lng: 139.73 }, // Central Tokyo / Yamanote loop area
      zoom: 24,
    },
  },
  {
    id: "chubu",
    name: "Chubu",
    nameJa: "中部",
    prefectures: ["15", "16", "17", "18", "19", "20", "21", "22", "23"], // Gifu Shizuoka Aichi Niigata Toyama Ishikawa Fukui Yamanashi Nagano
    initialView: {
      center: { lat: 35.1, lng: 136.9 }, // Central Chubu, near Nagoya/Matsumoto
      zoom: 6,
    },
  },
  {
    id: "kansai",
    name: "Kansai",
    nameJa: "関西",
    prefectures: ["24", "25", "26", "27", "28", "29", "30"], // Mie Shiga Kyoto Osaka Hyogo Nara Wakayama
    initialView: {
      center: { lat: 34.8, lng: 135.5 }, // Osaka / Kyoto corridor
      zoom: 8,
    },
  },
  {
    id: "chugoku",
    name: "Chugoku",
    nameJa: "中国",
    prefectures: ["31", "32", "33", "34", "35"], // Tottori Shimane Okayama Hiroshima Yamaguchi
    initialView: {
      center: { lat: 34.5, lng: 132.5 }, // Central Chugoku, near Hiroshima
      zoom: 1,
    },
  },
  {
    id: "shikoku",
    name: "Shikoku",
    nameJa: "四国",
    prefectures: ["36", "37", "38", "39"], // Tokushima Kagawa Ehime Kochi
    initialView: {
      center: { lat: 33.7, lng: 133.5 }, // Central Shikoku, near Matsuyama
      zoom: 1,
    },
  },
  {
    id: "kyushu",
    name: "Kyushu",
    nameJa: "九州",
    prefectures: ["40", "41", "42", "43", "44", "45", "46"], // Fukuoka Saga Nagasaki Kumamoto Oita Miyazaki Kagoshima
    initialView: {
      center: { lat: 32.8, lng: 130.8 }, // Central Kyushu, near Kumamoto
      zoom: 1,
    },
  },
  {
    id: "okinawa",
    name: "Okinawa",
    nameJa: "沖縄",
    prefectures: ["47"],
    initialView: {
      center: { lat: 26.2, lng: 127.7 }, // Naha, central Okinawa main island
      zoom: 0.1,
    },
  },
];
