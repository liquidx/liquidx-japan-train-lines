// APPROXIMATE vertical profiles for Tokyo-area lines, keyed by
// 運営会社 -> 路線名 as they appear in the N02-19 GeoJSON.
//
// `anchors` are station-name -> depth (meters relative to ground) control
// points, smoothly interpolated along the line; `base` is the constant depth
// used outside/instead of anchors. Values are hand-curated from published
// facts (Kokkai-gijidomae Chiyoda platform ~-38m, JR Keiyo Tokyo ~-29m,
// Ginza line emerging onto a viaduct at Shibuya, monorail/AGT viaducts, etc).
// Everything not listed here renders at ground level.

export const TOKYO_CENTER = { lon: 139.766, lat: 35.685 };

// Features farther than this from the center are dropped, so lines that
// continue far out of the Tokyo region (Tokaido, Utsunomiya, ...) don't blow
// up the scene bounds.
export const CLIP_RADIUS_M = 40000;

export const depthConfig = {
  東京地下鉄: {
    "3号線銀座線": {
      anchors: { 浅草: -5, 上野: -8, 日本橋: -14, 銀座: -13, 赤坂見附: -10, 表参道: -12, 渋谷: 14 },
    },
    "4号線丸ノ内線": {
      anchors: { 池袋: -10, 後楽園: 8, 御茶ノ水: 2, 東京: -18, 四ツ谷: 4, 新宿: -10, 荻窪: -9 },
    },
    "4号線丸ノ内線分岐線": { base: -8 },
    "2号線日比谷線": {
      anchors: { 北千住: 10, 上野: -14, 銀座: -20, 霞ケ関: -22, 六本木: -26, 恵比寿: -14, 中目黒: 8 },
    },
    "5号線東西線": {
      anchors: { 中野: 0, 高田馬場: -16, 大手町: -24, 門前仲町: -20, 南砂町: -12, 西葛西: 10, 浦安: 10, 西船橋: 8 },
    },
    "9号線千代田線": {
      anchors: { 北綾瀬: 10, 町屋: -16, 大手町: -22, 国会議事堂前: -38, 表参道: -17, 代々木上原: -2 },
    },
    "8号線有楽町線": {
      anchors: { 和光市: 0, 池袋: -16, 飯田橋: -22, 有楽町: -25, 月島: -30, 新木場: 4 },
    },
    "11号線半蔵門線": {
      anchors: { 渋谷: -20, 永田町: -30, 大手町: -26, 清澄白河: -28, 押上: -30 },
    },
    "7号線南北線": {
      anchors: { 目黒: -20, 麻布十番: -30, 永田町: -36, 後楽園: -30, 駒込: -20, 赤羽岩淵: -14 },
    },
    "13号線副都心線": {
      anchors: { 和光市: 0, 小竹向原: -20, 池袋: -25, 新宿三丁目: -30, 渋谷: -27 },
    },
  },

  東京都: {
    "1号線浅草線": { base: -16 },
    "6号線三田線": {
      anchors: { 目黒: -18, 白金台: -25, 大手町: -22, 巣鴨: -15, 西台: 8, 西高島平: 8 },
    },
    "10号線新宿線": {
      anchors: { 新宿: -25, 市ヶ谷: -20, 森下: -20, 東大島: 10, 船堀: 8, 本八幡: -18 },
    },
    "12号線大江戸線": {
      base: -30,
      anchors: { 光が丘: -15, 都庁前: -25, 新宿: -28, 麻布十番: -32, 六本木: -42, 両国: -25 },
    },
    荒川線: { base: 0 },
    "日暮里・舎人線": { base: 12 },
    東京臨海新交通臨海線: { base: 12 },
    上野懸垂線: { base: 5 },
  },

  東京臨海高速鉄道: {
    りんかい線: { anchors: { 大崎: 0, 大井町: -25, 東京テレポート: -30, 新木場: 5 } },
  },

  東京モノレール: {
    東京モノレール羽田空港線: { base: 12 },
  },

  東日本旅客鉄道: {
    "横須賀線 総武快速線": {
      anchors: { 品川: 0, 新橋: -20, 東京: -27, 馬喰町: -27, 錦糸町: 0 },
    },
    京葉線: {
      base: 6,
      anchors: { 東京: -29, 八丁堀: -22, 越中島: -15, 潮見: 6 },
    },
    山手線: { base: 3 },
    京浜東北線: { base: 3 },
    中央線: { base: 3 },
    埼京線: { base: 4 },
    湘南新宿ライン: { base: 4 },
    武蔵野線: { base: 5 },
    常磐線: { base: 3 },
    東海道線: { base: 2 },
    宇都宮線: { base: 2 },
    東北線: { base: 2 },
  },

  京王電鉄: {
    京王線: { anchors: { 新宿: -12, 笹塚: 0 } },
    井の頭線: { anchors: { 渋谷: 6, 神泉: 0 } },
  },

  京成電鉄: {
    押上線: { anchors: { 押上: -10, 青砥: 8 } },
    本線: { base: 2 },
  },

  東急電鉄: {
    東横線: { base: 2, anchors: { 渋谷: -27, 代官山: -5, 中目黒: 8, 自由が丘: 2 } },
    田園都市線: { base: 0, anchors: { 渋谷: -22, 池尻大橋: -15, 二子玉川: 2 } },
    目黒線: { base: 0, anchors: { 目黒: -15, 洗足: -8, 田園調布: 0 } },
  },

  東武鉄道: {
    スカイツリーライン: { base: 4 },
    伊勢崎線: { base: 3 },
    東上本線: { base: 2 },
  },

  西武鉄道: {
    西武池袋線: { base: 2 },
    西武新宿線: { base: 2 },
  },

  北総鉄道: {
    北総線: { base: 3 },
  },
};

export const depthForLine = (company, line) =>
  depthConfig[company]?.[line] ?? { base: 0 };
