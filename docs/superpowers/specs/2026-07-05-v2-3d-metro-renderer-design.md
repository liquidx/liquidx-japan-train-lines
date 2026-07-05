# v2 Experimental 3D Metro Renderer — Design

**Date:** 2026-07-05
**Status:** Experiment (not part of the published library)
**Reference:** "Tokyo Metro Live Map" video (`~/Dropbox/Screens/Tokyo Metro Live Map.mp4`)

## What the reference does (video analysis)

The video shows a 3D "physical model" (diorama) style visualization of the 9 Tokyo
Metro lines:

1. **3D scene with real depth.** Lines are drawn at their actual elevation —
   underground lines below a translucent ground plane, elevated sections above it.
   Header stats: `MAX DEPTH -38m 国会議事堂前`, `MAX HEIGHT +14m 渋谷(銀座線)`.
   A **depth exaggeration slider** (×17–×22) stretches the vertical axis so a few
   tens of meters read at city scale. A depth ruler (+10m … −50m) sits at the right edge.
2. **Timetable-driven train animation.** Glowing dots move along every line
   according to the real weekday timetable (平日ダイヤ). Bottom bar: clock,
   scrubber over the service day (5:00–24:00+), playback speed presets
   (×1/×30/×60/×100/×480), live "trains in service" counter (e.g. 114 → 356 at rush).
3. **Model furniture.** Toggleable: "model pillars" connecting underground lines to
   the ground plane (like a physical model's supports), transfer-station connector
   columns, a ground grid, and a dark semi-transparent basemap (CARTO/OSM) with an
   opacity slider (75%).
4. **Camera.** Orbit/pan/zoom, auto-rotate toggle, presets: 鳥瞰 (bird's eye),
   真上 (top-down), 断面(横) (side cross-section), 地底から (from underground).
5. **UI.** Left collapsible panel (line toggles with station counts, depth slider,
   map options, label tiers なし/主要駅/全駅, display toggles, camera presets);
   click a train → follow-cam card (ESC to release).

## Why a separate renderer

The v1 renderer builds an SVG string and injects it via `innerHTML`. That is fine
for static 2D maps but cannot express a tilted perspective camera, per-vertex
depth, or hundreds of independently animated trains at 60 fps. A 3D mode is a
different renderer, not an extension of the SVG one.

## Approaches considered

- **A. Three.js custom scene (chosen).** Matches the diorama aesthetic exactly;
  single dependency; renders entirely from the GeoJSON already in `static/`;
  no tile server or API keys. WebGL lines + point sprites easily handle
  9 lines × ~300 trains.
- **B. MapLibre GL JS + deck.gl** (the mini-tokyo-3d approach). Gives a real
  basemap and geo-camera for free, but two heavy dependencies, a tile-source
  dependency, and the result reads as "map with overlay" rather than "model".
  Right choice if v2 ever needs the whole Kanto network over a real city map.
- **C. Pseudo-3D in the existing SVG renderer** (isometric projection). Cheap but
  cannot orbit, occlude, or animate at this scale. Rejected.

## Scope (v2 experiment)

Route `/v2`, all files colocated in `src/routes/v2/` so nothing leaks into the
published package (`svelte-package` only ships `src/lib`).

- **Data**: fetch `/N02-19_RailroadSection.geojson` + `/N02-19_Station.geojson`,
  filter `運営会社 === "東京地下鉄"`, join segments with the existing
  `joinSegments` from `$lib/train-lines.js`. Other Tokyo railways drawn as faint
  ground-level context lines (reuses `tokyoTrainLineNames` allowlist).
- **Depth model**: approximate, hand-curated per-line depth profiles (control
  points along each line's arc length), anchored to known facts (Ginza line +14 m
  at Shibuya, Chiyoda line −38 m at Kokkai-gijidomae, newer lines deeper).
  Clearly labeled approximate. Real per-station depth is not available as open
  data; see Data sources below.
- **Trains**: synthetic timetable — per-line service window 05:00–24:30, headway
  varying by time of day (rush ≈ 2.5–4 min, midday ≈ 5–6 min), constant average
  speed ≈ 33 km/h, both directions. Engine returns all active train positions for
  a clock time `t`, so a real ODPT timetable can replace it later behind the same
  interface.
- **Rendering**: dark scene; lines as fat lines (`Line2`) drawn twice (halo +
  core) for glow; trains as additive-blended point sprites; stations as dim
  points; translucent ground plane + grid; station pillars as faint vertical
  segments; station labels via `CSS2DRenderer` with tiers (none / transfers /
  all); depth ruler; depth exaggeration implemented as a Y scale on the depth
  group (no geometry rebuild).
- **Camera**: `OrbitControls`, auto-rotate toggle, presets (bird / top / side /
  below).
- **UI**: left panel (line toggles, depth slider, display toggles, label tiers,
  camera presets), bottom playback bar (play/pause, clock, scrubber, speed
  presets, trains-in-service count), header stats (max depth / max height).

Out of scope for this experiment: real timetables, real-time train positions,
train follow-cam, basemap tiles, mobile gestures beyond what OrbitControls gives.

## Data sources (for the real thing)

- **Timetables / real-time positions**: ODPT — Public Transportation Open Data
  Center (`developer.odpt.org`, `api.odpt.org`). Free registration;
  `odpt:TrainTimetable`, `odpt:Train` (real-time), covers Tokyo Metro + Toei +
  others. This is what mini-tokyo-3d uses.
- **Ground elevation**: GSI (国土地理院) elevation tiles / API
  (`cyberjapandata.gsi.go.jp`), DEM5A/10B.
- **Station platform depth**: no open dataset; community/press-compiled lists
  exist per line (approximate curation required, as done here).

(Details and verification in the research summary accompanying this change.)

## Files

| File | Purpose |
|---|---|
| `src/routes/v2/+page.svelte` | Page shell: loads GeoJSON, mounts the renderer |
| `src/routes/v2/TrainMap3D.svelte` | Three.js scene + HUD UI; reuses v1's `LineSelector` for company/line selection |
| `src/routes/v2/depth-config.js` | Approximate vertical profiles per 運営会社→路線名 (anchors + base depths) |
| `src/routes/v2/geo.js` | lat/lng→local-meter projection; builds line models (joined path, arc-length table, station projection) |
| `src/routes/v2/schedule.js` | Synthetic timetable engine: `trainsAt(lineModel, clockSeconds)` |
| `src/routes/v2/Slider.svelte` | shadcn-svelte-style single-thumb slider (bits-ui primitive) used by the timeline scrubber |

New dev dependencies: `three`, `bits-ui`.

## Revision (same day): whole-Tokyo network

Extended from the 9 Tokyo Metro lines to the full Tokyo network (56
company::line groups across 10 operators), using the same network definition
as v1 (`getTokyoGeoJson`) with features clipped to a 40 km radius so lines
that continue far out of Kanto don't blow up the scene. Line colors come from
`$lib/line-colors.js`; company/line selection reuses v1's `LineSelector`
overlay (select company → only its lines; select line → solo; "all regional
lines" → everything). Branding switched to "Japan Train Lines / 日本鉄道路線図".
Depth config gained Toei subway, deep JR sections (Keiyo/Sobu-rapid Tokyo),
Rinkai line, monorail/AGT viaducts, and private-railway underground termini.
~1,400 synthetic trains animate at morning rush.

**Label optimization:** station labels moved from CSS2DRenderer (one DOM node
per station) to a single 2D canvas overlay (`labels.js`). Labels are projected
manually each frame, sorted major-first/nearest-first, and placed through a
screen-space occupancy grid so overlapping labels are skipped; distance fades
them out before the fog. CSS2DRenderer was removed entirely (ruler text moved
to the same canvas; OrbitControls now attaches to the WebGL canvas). Measured:
full-network "all stations" pass = 0.34 ms/frame (642 deduped candidates →
~150 drawn at bird view) vs 5.1 ms for the WebGL render.

## Revision (same day): region switching, camera fit-to-selection, timeline polish

Region support: the LineSelector's region grid (全国/北海道/東北/関東/東京/中部/関西/
中国/四国/九州/沖縄, from `$lib/regions.js`) now drives v2 too. Switching regions
disposes and rebuilds the whole scene graph (`disposeRegion`/`buildRegion`) with
a scale fitted to the 95th-percentile station distance from the region's
`initialView.center`, so 全国 (27k synthetic trains, 594 lines) and a single
region both frame sensibly. `line-region-index.json` is now fetched alongside
the two GeoJSON files.

Camera: selecting a company or line now flies the camera to fit the visible
network (`fitToVisible`, centered on the median station position with a
95th-percentile radius so one outlying branch doesn't skew the framing) rather
than leaving the region-wide view. All camera moves (presets and fits) animate
over ~0.7s (`flyTo`); grabbing the OrbitControls mid-flight cancels the
animation.

Timeline: replaced the native `<input type="range">` scrubber with a
shadcn-svelte-style `Slider.svelte` built on `bits-ui`'s headless Slider
primitive (`type="single"`), styled to the v2 HUD rather than shadcn's default
Tailwind tokens (which this app doesn't define). Play/pause now uses
`@lucide/svelte`'s `Play`/`Pause` icons, matching the icons used elsewhere in
the app. The "運行中" trains-in-service counter was removed — it re-rendered
every frame and read as flicker rather than a useful readout.
