# Tokyo Train Line Maps

This is a web based tool to inspect the train line data from 国土数値情報 (Japan's National Land Information).
It is packaged as a Svelte component so it can be also embedded in other Svelte projects.

![alt text](./misc/yamanoteLine.png "Yamanote Line Example In App")

_The Yamanote Line Displayed in-app_

Before building and running this, you must download the data from the Japanese Government GIS website.

## Downloading the data

1. Visit the [Japan GIS Homepage](http://nlftp.mlit.go.jp/ksj/index.html)
2. Click on the link that is in section 4 [鉄道](https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-v2_3.html)
3. Select 全国 check box and press the 次へ button.
4. In the list of downloads, select N02-19_GML.zip (平成 30 年) and press the 次へ button.

## Running the Project

The data is not included, so follow the instructions above to download and extract to the `static/` folder.

The app expects the folders and files in the following structure:

```
projectRoot
└───static
│   │   N02-18_RailroadSection.geojson
│   │   N02-18_Station.geojson
```

After extracting the data, build and run.

```
pnpm install
pnpm run dev

# open up http://localhost:5173/
```

The inspect simply displays the train line that was selected in SVG, scaled to a fixed width.

## Opening the data

The shp file can be opened in QGIS and explored using that app. However, you need to modify the import settings to understand JIS encoding.

1. Open in QGIS by installing it and then double clicking on the file. For some reason you can't open it up using File > Open in QGIS.

2. To set the correct encoding, go to Layer > Layer Properties > Source and choose "Shift_JIS".
