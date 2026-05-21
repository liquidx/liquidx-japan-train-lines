const colorMap = {
  // JR East (東日本旅客鉄道)
  "東日本旅客鉄道": {
    "山手線": "#80c241",
    "中央線": "#f15a22",
    "中央本線": "#f15a22",
    "中央線快速": "#f15a22",
    "総武線": "#ffd400",
    "中央・総武緩行線": "#ffd400",
    "京浜東北線": "#00b2e2",
    "根岸線": "#00b2e2",
    "東海道線": "#f68b1e",
    "横須賀線": "#003399",
    "湘南新宿ライン": "#31b980",
    "埼京線": "#009966",
    "京葉線": "#c9242f",
    "武蔵野線": "#f15a22",
    "南武線": "#ffd400",
    "横浜線": "#80c241",
    "東北線": "#f68b1e",
    "宇都宮線": "#f68b1e",
    "常磐線": "#00533f",
    "常磐線快速": "#00533f",
    "常磐線各駅停車": "#00bb85",
    "五日市線": "#f15a22",
    "青梅線": "#f15a22",
    "八高線": "#80c241",
    "鶴見線": "#ffd400",
    "相模線": "#00b2e2",
    "伊東線": "#003399",
    "奥羽線": "#FE742A",
    "羽越線": "#11B0D3",

  },
  // Tokyo Metro (東京地下鉄)
  "東京地下鉄": {
    "3号線銀座線": { light: "#ff9500", dark: "#ffb144" },
    "銀座線": { light: "#ff9500", dark: "#ffb144" },
    "4号線丸ノ内線": "#f30100",
    "丸ノ内線": "#f30100",
    "4号線丸ノ内線分岐線": "#f30100",
    "丸ノ内線分岐線": "#f30100",
    "2号線日比谷線": "#9ca5b9",
    "日比谷線": "#9ca5b9",
    "5号線東西線": "#009bda",
    "東西線": "#009bda",
    "9号線千代田線": "#00bb85",
    "千代田線": "#00bb85",
    "8号線有楽町線": "#c1a470",
    "有楽町線": "#c1a470",
    "11号線半蔵門線": "#8f76d6",
    "半蔵門線": "#8f76d6",
    "7号線南北線": "#00ac9a",
    "南北線": "#00ac9a",
    "13号線副都心線": "#9c5e31",
    "副都心線": "#9c5e31"
  },
  // Toei Subway & Tokyo Metropolitan (東京都)
  "東京都": {
    "1号線浅草線": "#e85294",
    "浅草線": "#e85294",
    "6号線三田線": "#007bc3",
    "三田線": "#007bc3",
    "10号線新宿線": "#b0ca1a",
    "新宿線": "#b0ca1a",
    "12号線大江戸線": "#b6007a",
    "大江戸線": "#b6007a",
    "荒川線": "#e93b82",
    "都電荒川線": "#e93b82",
    "日暮里・舎人線": "#1cbbb4",
    "日暮里・舎人ライナー": "#1cbbb4"
  },
  // Tokyu (東急電鉄)
  "東急電鉄": {
    "東横線": "#e02428",
    "田園都市線": "#009b72",
    "大井町線": "#f59b00",
    "目黒線": "#009bc5",
    "池上線": "#e0558e",
    "東急多摩川線": "#9a287c",
    "世田谷線": "#ffd400",
    "こどもの国線": "#003f8a"
  },
  // Keikyu (京浜急行電鉄)
  "京浜急行電鉄": {
    "本線": "#df1623",
    "空港線": "#df1623",
    "逗子線": "#df1623",
    "久里浜線": "#df1623",
    "大師線": "#df1623"
  },
  // Keio (京王電鉄)
  "京王電鉄": {
    "京王線": "#e3007f",
    "井の頭線": "#00a0e9",
    "相模原線": "#e3007f",
    "高尾線": "#e3007f",
    "競馬場線": "#e3007f",
    "動物園線": "#e3007f"
  },
  // Odakyu (小田急電鉄)
  "小田急電鉄": {
    "小田原線": "#007bc3",
    "江ノ島線": "#007bc3",
    "多摩線": "#007bc3"
  },
  // Seibu (西武鉄道)
  "西武鉄道": {
    "新宿線": "#009bc5",
    "拝島線": "#009bc5",
    "西武園線": "#009bc5",
    "国分寺線": "#21A34A",
    "多摩湖線": "#F5A62D",
    "多摩川線": "#EC6F20",
    "池袋線": "#ffd400",
    "西武秩父線": "#ffd400",
    "狭山線": "#ffd400",
    "有楽町線": "#ffd400",
    "豊島線": "#ffd400",
    "山口線": "#009bc5"
  },
  // Tobu (東武鉄道)
  "東武鉄道": {
    "東上本線": "#003f8a",
    "越生線": "#003f8a",
    "伊勢崎線": "#ffd400",
    "スカイツリーライン": "#ffd400",
    "亀戸線": "#ffd400",
    "野田線": "#00865c",
    "アーバンパークライン": "#00865c",
    "日光線": "#f68b1e"
  },
  // Keisei (京成電鉄)
  "京成電鉄": {
    "京成本線": "#0054af",
    "押上線": "#0054af",
    "金町線": "#0054af",
    "千原線": "#0054af",
    "東成田線": "#0054af",
    "成田空港線": "#0054af"
  },
  // Osaka Metro (大阪市高速電気軌道)
  "大阪市高速電気軌道": {
    "御堂筋線": "#e51837",
    "谷町線": "#9b1c60",
    "四つ橋線": "#007bc3",
    "中央線": "#00984f",
    "千日前線": "#e25d97",
    "堺筋線": "#804000",
    "長堀鶴見緑地線": "#a0d235",
    "今里筋線": "#ee7b1a"
  },
  // JR West (西日本旅客鉄道)
  "西日本旅客鉄道": {
    "大阪環状線": "#f15a22",
    "桜島線": "#99cc00",
    "ゆめ咲線": "#99cc00",
    "東海道線": "#00b2e2",
    "山陽線": "#00b2e2",
    "福知山線": "#ffd400",
    "宝塚線": "#ffd400",
    "関西線": "#ffd400",
    "大和路線": "#ffd400",
    "片町線": "#ffd400",
    "学研都市線": "#ffd400",
    "阪和線": "#ffd400",
    "関西空港線": "#ffd400",
    "紀勢線": "#ffd400",
    "きのくに線": "#ffd400"
  },
  // Hankyu (阪急電鉄)
  "阪急電鉄": {
    "京都線": "#800000",
    "神戸線": "#800000",
    "宝塚線": "#800000",
    "千里線": "#800000",
    "嵐山線": "#800000",
    "伊丹線": "#800000",
    "甲陽線": "#800000",
    "今津線": "#800000"
  },
  // Hanshin (阪神電気鉄道)
  "阪神電気鉄道": {
    "本線": "#002f6c",
    "なんば線": "#ee7b1a",
    "武庫川線": "#002f6c"
  },
  // Keihan (京阪電気鉄道)
  "京阪電気鉄道": {
    "京阪本線": "#006934",
    "中之島線": "#006934",
    "交野線": "#006934",
    "宇治線": "#006934",
    "鴨東線": "#006934"
  },
  "東京臨海高速鉄道": {
    "りんかい線": "#282B79"
  }
};

const colorForTheme = (color, mapTheme = "dark") => {
  if (!color) return null;

  if (typeof color === "string") {
    return color;
  }

  if (mapTheme === "light") {
    return color.light || color.dark || null;
  }

  return color.dark || color.light || null;
};

const findLineColorDefinition = (companyName, lineName) => {
  if (!companyName || !lineName) return null;

  // Try exact match
  if (colorMap[companyName] && colorMap[companyName][lineName]) {
    return colorMap[companyName][lineName];
  }

  // Try partial match on line name (e.g. "山手線" might match "山手")
  if (colorMap[companyName]) {
    for (const key of Object.keys(colorMap[companyName])) {
      if (lineName.includes(key) || key.includes(lineName)) {
        return colorMap[companyName][key];
      }
    }
  }

  // Try generic matching across all companies if the company is not found
  for (const comp of Object.keys(colorMap)) {
    if (colorMap[comp][lineName]) {
      return colorMap[comp][lineName];
    }
    for (const key of Object.keys(colorMap[comp])) {
      if (lineName.includes(key) || key.includes(lineName)) {
        return colorMap[comp][key];
      }
    }
  }

  return null;
};

export const getLineColor = (companyName, lineName, mapTheme = "dark") => {
  return colorForTheme(findLineColorDefinition(companyName, lineName), mapTheme);
};
