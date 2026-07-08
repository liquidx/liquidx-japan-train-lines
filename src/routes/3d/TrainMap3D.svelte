<svelte:options runes={true} />

<script>
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
  import { Line2 } from "three/addons/lines/Line2.js";
  import { LineGeometry } from "three/addons/lines/LineGeometry.js";
  import { LineMaterial } from "three/addons/lines/LineMaterial.js";
  import { Play, Pause } from "@lucide/svelte";

  import LineSelector from "$lib/LineSelector.svelte";
  import { LabelLayer } from "./labels.js";
  import { getTokyoGeoJson } from "$lib/japan-train-lines.js";
  import { getLineColor } from "$lib/line-colors.js";
  import { regions } from "$lib/regions.js";
  import { CLIP_RADIUS_M, depthForLine } from "./depth-config.js";
  import { makeProjector, buildLineModel, pointAt } from "./geo.js";
  import {
    trainsAt,
    maxTrains,
    formatClock,
    SERVICE_START,
    SERVICE_END,
  } from "./schedule.js";

  let { railroadGeoJson, stationGeoJson, lineRegionIndex = null } = $props();

  // ---- UI state ----
  let selectedRegion = $state("tokyo");
  let regionBuilding = $state(false);
  let selectedCompany = $state(null);
  let selectedLine = $state(null);
  let companyList = $state([]);
  let mapTheme = $state("dark"); // bound by LineSelector; scene stays dark
  let exaggeration = $state(15);
  let playing = $state(true);
  let speed = $state(60);
  let clockSec = $state(7.5 * 3600);
  let showTrains = $state(true);
  let styleGlow = $state(false);
  let autoRotate = $state(false);
  let showPillars = $state(true);
  let showGrid = $state(true);
  let labelTier = $state("major"); // none | major | all
  let forceShowStations = $state(false);
  let stationSizeMultiplier = $state(1);

  // Zoom-dependent station visibility, mirroring v1: stations appear only
  // past a screen-density threshold (px per scene-meter at the orbit target),
  // unless forced on from the appearance tab.
  const STATION_SHOW_PX_PER_M = 0.045;
  const TRAIN_BASE_PX_PER_M = 0.032; // px/m at the default bird view

  const SPEEDS = [1, 60, 120, 300, 600];
  const FALLBACK_COLOR = "#7c8db0";
  const PRIORITY_COMPANIES = ["東日本旅客鉄道", "東京地下鉄", "東京都"];

  let container;
  let labelCanvas;
  let three = null;

  const glowTexture = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  };

  // Station marker: white disc with a dark rim (classic transit-map look).
  const stationTexture = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(16, 16, 13, 0, Math.PI * 2);
    ctx.fillStyle = "#0a0f1c";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(16, 16, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#e8f0ff";
    ctx.fill();
    return new THREE.CanvasTexture(c);
  };

  // Train marker: solid dot in a darker shade of the line's color with a
  // thin white rim, so it reads as a vehicle and stays visible on top of its
  // own line. The rim is deliberately thin — at small point sizes a thick
  // rim swamps the fill and the dot reads as white.
  const trainTexture = (colorCss) => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const ctx = c.getContext("2d");
    ctx.beginPath();
    ctx.arc(16, 16, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(16, 16, 12.5, 0, Math.PI * 2);
    ctx.fillStyle = colorCss;
    ctx.fill();
    return new THREE.CanvasTexture(c);
  };

  // A line entry is shown when nothing is selected, or when it matches the
  // current company/line selection from the LineSelector.
  const isEntryVisible = (meta) =>
    !selectedCompany
      ? true
      : meta.company === selectedCompany &&
        (!selectedLine || meta.line === selectedLine);

  // Region slice of a GeoJSON, mirroring v1's loadTrainLines caches:
  // "japan" = everything, "tokyo" = the special allowlist filter, other
  // regions = precomputed line-region-index lookup.
  const regionFeatures = (geojson, region) => {
    if (region.id === "japan") return geojson.features;
    if (region.id === "tokyo")
      return getTokyoGeoJson(geojson, railroadGeoJson).features;
    return geojson.features.filter((f) => {
      const line = f.properties?.["路線名"];
      const company = f.properties?.["運営会社"];
      if (!line || !company) return false;
      return (
        lineRegionIndex?.[`${company}::${line}`]?.includes(region.id) ?? false
      );
    });
  };

  // One-time three.js setup: renderer, camera, controls, label canvas.
  // Everything region-specific lives under `regionRoot` and is rebuilt by
  // buildRegion().
  const initThree = () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060c);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(50, 1, 10, 300000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.95;

    const labelLayer = new LabelLayer(labelCanvas);

    const t = {
      scene,
      renderer,
      camera,
      controls,
      labelLayer,
      regionRoot: null,
      depthGroup: null,
      grid: null,
      plane: null,
      perLine: new Map(),
      lineMaterials: [],
      regionScale: 40000,
      viewport: { w: 1, h: 1 },
      camAnim: null,
    };
    // Grabbing the controls cancels any in-flight camera animation.
    controls.addEventListener("start", () => {
      t.camAnim = null;
    });
    return t;
  };

  // Animate the camera to a new position/target over ~0.7s.
  const flyTo = (toPos, toTgt, instant = false) => {
    const { camera, controls } = three;
    if (instant) {
      three.camAnim = null;
      camera.position.copy(toPos);
      controls.target.copy(toTgt);
      return;
    }
    three.camAnim = {
      start: performance.now(),
      dur: 700,
      fromPos: camera.position.clone(),
      fromTgt: controls.target.clone(),
      toPos,
      toTgt,
    };
  };

  // Frame the currently visible lines at the current orbit direction, close
  // enough to fill the view but never farther than the whole-region view.
  // Centered on the median of the visible stations with a 95th-percentile
  // radius, so one long tail (e.g. a line running far out of the city)
  // doesn't drag the framing off the network's core.
  const fitToVisible = () => {
    const { camera, controls } = three;
    const xs = [];
    const zs = [];
    for (const entry of three.perLine.values()) {
      if (!isEntryVisible(entry.model.meta)) continue;
      for (const st of entry.model.stations) {
        if (st.s === null) continue;
        xs.push(st.x);
        zs.push(st.z);
      }
      if (entry.model.stations.length === 0) {
        // Rare: a line with no matched stations — sample path vertices.
        const p = entry.model.paths[entry.model.mainPath].positions;
        for (let i = 0; i < p.length; i += 30) {
          xs.push(p[i]);
          zs.push(p[i + 2]);
        }
      }
    }
    if (xs.length === 0) return;

    const sortedX = [...xs].sort((a, b) => a - b);
    const sortedZ = [...zs].sort((a, b) => a - b);
    const cx = sortedX[Math.floor(sortedX.length / 2)];
    const cz = sortedZ[Math.floor(sortedZ.length / 2)];
    const dists = xs
      .map((x, i) => Math.hypot(x - cx, zs[i] - cz))
      .sort((a, b) => a - b);
    const r = Math.max(1500, dists[Math.floor(dists.length * 0.95)]);
    const vfov = (camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = Math.max(
      4000,
      Math.min(
        3 * three.regionScale,
        (r * 1.2) / Math.tan(Math.min(vfov, hfov) / 2),
      ),
    );
    // Keep the current orbit direction, but not too flat.
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() < 1) dir.set(0, 0.475, 0.625);
    dir.normalize();
    if (dir.y < 0.3) {
      dir.y = 0.3;
      dir.normalize();
    }
    flyTo(
      new THREE.Vector3(cx + dir.x * dist, dir.y * dist, cz + dir.z * dist),
      new THREE.Vector3(cx, 0, cz),
    );
  };

  const disposeRegion = () => {
    if (!three.regionRoot) return;
    three.regionRoot.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          m.dispose();
        }
      }
    });
    three.scene.remove(three.regionRoot);
    three.regionRoot = null;
    three.perLine = new Map();
    three.lineMaterials = [];
    three.labelLayer.stations = [];
    three.labelLayer.rulers = [];
  };

  // Re-apply the current UI state to freshly built scene objects (the
  // $effects below only rerun when the state itself changes).
  const applyDisplayState = () => {
    three.grid.visible = showGrid;
    three.depthGroup.scale.y = exaggeration;
    for (const entry of three.perLine.values()) {
      entry.group.visible = isEntryVisible(entry.model.meta);
      entry.pillars.visible = showPillars;
      for (const halo of entry.halos) halo.visible = styleGlow;
      entry.trains.material = styleGlow
        ? entry.trainGlowMat
        : entry.trainSolidMat;
    }
  };

  const buildRegion = (regionId) => {
    const region = regions.find((r) => r.id === regionId) || regions[0];
    const center = region.initialView.center;
    const project = makeProjector({ lon: center.lng, lat: center.lat });

    const rails = regionFeatures(railroadGeoJson, region);
    const stationFeats = regionFeatures(stationGeoJson, region);

    // Tokyo additionally clips to a fixed radius: its allowlisted lines run
    // far beyond the city (Tokaido, Utsunomiya, ...).
    const withinRadius = (f) =>
      region.id !== "tokyo" ||
      f.geometry.coordinates.some(([lon, lat]) => {
        const [x, z] = project(lon, lat);
        return Math.hypot(x, z) < CLIP_RADIUS_M;
      });

    const railByKey = new Map();
    for (const f of rails) {
      if (!withinRadius(f)) continue;
      const key = `${f.properties["運営会社"]}::${f.properties["路線名"]}`;
      if (!railByKey.has(key)) railByKey.set(key, []);
      railByKey.get(key).push(f);
    }
    const stationsByKey = new Map();
    for (const f of stationFeats) {
      if (!withinRadius(f)) continue;
      const key = `${f.properties["運営会社"]}::${f.properties["路線名"]}`;
      if (!stationsByKey.has(key)) stationsByKey.set(key, []);
      stationsByKey.get(key).push(f);
    }

    // Build one model per company::line.
    const models = [];
    for (const [key, rails] of railByKey) {
      const [company, line] = key.split("::");
      const meta = {
        key,
        company,
        line,
        color: getLineColor(company, line, "dark") || FALLBACK_COLOR,
        depth: depthForLine(company, line),
      };
      const model = buildLineModel(
        meta,
        rails,
        stationsByKey.get(key) || [],
        project,
      );
      if (model) models.push(model);
    }

    // Company -> lines list for the LineSelector, prioritized like v1.
    const byCompany = new Map();
    for (const m of models) {
      if (!byCompany.has(m.meta.company)) byCompany.set(m.meta.company, []);
      byCompany.get(m.meta.company).push(m.meta.line);
    }
    const companies = [...byCompany.keys()].sort(
      (a, b) => byCompany.get(b).length - byCompany.get(a).length,
    );
    const ordered = [
      ...PRIORITY_COMPANIES.filter((c) => byCompany.has(c)),
      ...companies.filter((c) => !PRIORITY_COMPANIES.includes(c)),
    ];
    companyList = ordered.map((company) => ({
      company,
      lines: byCompany.get(company).sort(),
    }));

    // Stations served by >= 3 lines get "major" labels (whole-network view
    // has far more transfers than the metro-only view).
    const nameCount = new Map();
    for (const m of models)
      for (const st of m.stations)
        nameCount.set(st.name, (nameCount.get(st.name) || 0) + 1);

    // Scene scale: fit to the 95th percentile of station distances from the
    // region center. Index-matched lines can run far outside the region
    // (shinkansen); the fog hides those tails instead of clipping them.
    const stationDists = [];
    for (const m of models)
      for (const st of m.stations)
        if (st.s !== null) stationDists.push(Math.hypot(st.x, st.z));
    stationDists.sort((a, b) => a - b);
    const p95 = stationDists[Math.floor(stationDists.length * 0.95)] || 40000;
    const R = Math.max(30000, p95 * 1.15);

    // ---- rebuild the region's scene graph ----
    disposeRegion();
    const regionRoot = new THREE.Group();
    three.scene.add(regionRoot);
    three.regionRoot = regionRoot;
    three.regionScale = R;
    three.scene.fog = new THREE.Fog(0x04060c, 1.15 * R, 3.5 * R);
    three.camera.far = Math.max(300000, 10 * R);
    three.camera.updateProjectionMatrix();

    const grid = new THREE.GridHelper(2.1 * R, 84, 0x1a2a52, 0x0b1226);
    grid.position.y = -2;
    regionRoot.add(grid);
    three.grid = grid;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1 * R, 2.1 * R),
      new THREE.MeshBasicMaterial({
        color: 0x070b16,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.renderOrder = 1;
    regionRoot.add(plane);
    three.plane = plane;

    const depthGroup = new THREE.Group();
    depthGroup.scale.y = exaggeration;
    regionRoot.add(depthGroup);
    three.depthGroup = depthGroup;

    const glow = glowTexture();
    const stationDot = stationTexture();
    const lineMaterials = three.lineMaterials;
    const perLine = three.perLine; // key -> {group, trains, ...}

    for (const model of models) {
      const meta = model.meta;
      const color = new THREE.Color(meta.color);
      const group = new THREE.Group();
      const halos = [];

      for (const path of model.paths) {
        const geom = new LineGeometry();
        geom.setPositions(Array.from(path.positions));
        const core = new LineMaterial({ color, linewidth: 2.5 });
        const halo = new LineMaterial({
          color,
          linewidth: 7,
          transparent: true,
          opacity: 0.11,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        lineMaterials.push(core, halo);
        const coreLine = new Line2(geom, core);
        const haloLine = new Line2(geom, halo);
        haloLine.renderOrder = 2;
        haloLine.visible = styleGlow;
        coreLine.computeLineDistances();
        haloLine.computeLineDistances();
        group.add(coreLine, haloLine);
        halos.push(haloLine);
      }

      const stPos = [];
      for (const st of model.stations) {
        if (st.s === null) continue;
        stPos.push(st.x, st.y, st.z);
      }
      const stGeom = new THREE.BufferGeometry();
      stGeom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(stPos, 3),
      );
      const stations = new THREE.Points(
        stGeom,
        new THREE.PointsMaterial({
          // Tints the white disc of the station texture to the line color;
          // the dark rim stays dark.
          color,
          size: 5.5,
          sizeAttenuation: false,
          map: stationDot,
          transparent: true,
          depthWrite: false,
        }),
      );
      stations.renderOrder = 3;
      group.add(stations);

      // Pillars only where a line actually leaves ground level.
      const pillarPos = [];
      for (const st of model.stations) {
        if (st.s === null || Math.abs(st.y) < 4) continue;
        pillarPos.push(st.x, st.y, st.z, st.x, 0, st.z);
      }
      const pillarGeom = new THREE.BufferGeometry();
      pillarGeom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(pillarPos, 3),
      );
      const pillars = new THREE.LineSegments(
        pillarGeom,
        new THREE.LineBasicMaterial({
          color: 0x93a9d1,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        }),
      );
      group.add(pillars);

      const cap = maxTrains(model);
      const trainGeom = new THREE.BufferGeometry();
      const trainArr = new Float32Array(cap * 3);
      const attr = new THREE.BufferAttribute(trainArr, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      trainGeom.setAttribute("position", attr);
      trainGeom.setDrawRange(0, 0);
      const trainGlowMat = new THREE.PointsMaterial({
        color: color.clone().lerp(new THREE.Color(0xffffff), 0.35),
        size: 12,
        sizeAttenuation: false,
        map: glow,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const trainSolidMat = new THREE.PointsMaterial({
        color: color.clone(),
        size: 9,
        sizeAttenuation: false,
        map: trainTexture(
          "#" +
            color.clone().lerp(new THREE.Color(0x000000), 0.3).getHexString(),
        ),
        // Hard cutout instead of alpha blending: blending the sprite's
        // antialiased edges over the bright line beneath washed the color out.
        alphaTest: 0.5,
      });
      const trains = new THREE.Points(
        trainGeom,
        styleGlow ? trainGlowMat : trainSolidMat,
      );
      trains.renderOrder = 4;
      trains.frustumCulled = false;
      group.add(trains);

      depthGroup.add(group);
      perLine.set(meta.key, {
        group,
        model,
        trains,
        trainGeom,
        trainArr,
        trainGlowMat,
        trainSolidMat,
        halos,
        stations,
        pillars,
        cap,
      });
    }

    // Station labels, deduped by name across all lines, drawn on a 2D
    // canvas overlay (see labels.js) instead of per-station DOM nodes.
    const labelLayer = three.labelLayer;
    const labeled = new Map();
    for (const model of models) {
      for (const st of model.stations) {
        if (st.s === null) continue;
        let item = labeled.get(st.name);
        if (!item) {
          item = {
            x: st.x,
            y: st.y,
            z: st.z,
            name: st.name,
            isMajor: (nameCount.get(st.name) || 0) >= 3,
            keys: new Set(),
          };
          labeled.set(st.name, item);
          labelLayer.stations.push(item);
        }
        item.keys.add(model.meta.key);
      }
    }

    // Depth ruler at the east edge.
    const ruler = new THREE.Group();
    const rulerX = 0.65 * R;
    const rulerPos = [rulerX, -50, 0, rulerX, 20, 0];
    for (let d = -50; d <= 20; d += 10) {
      rulerPos.push(rulerX - 300, d, 0, rulerX + 300, d, 0);
      labelLayer.rulers.push({
        x: rulerX + 900,
        y: d,
        z: 0,
        text: d > 0 ? `+${d}m` : `${d}m`,
      });
    }
    const rulerGeom = new THREE.BufferGeometry();
    rulerGeom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(rulerPos, 3),
    );
    ruler.add(
      new THREE.LineSegments(
        rulerGeom,
        new THREE.LineBasicMaterial({
          color: 0x5b76a8,
          transparent: true,
          opacity: 0.5,
        }),
      ),
    );
    depthGroup.add(ruler);

    for (const m of lineMaterials)
      m.resolution.set(three.viewport.w, three.viewport.h);

    applyDisplayState();
    setCamera("bird", true);
  };

  const selectRegion = (id) => {
    if (!three || id === selectedRegion || regionBuilding) return;
    selectedRegion = id;
    selectedCompany = null;
    selectedLine = null;
    regionBuilding = true;
    // Let the loading overlay paint before the synchronous rebuild.
    setTimeout(() => {
      buildRegion(id);
      regionBuilding = false;
    }, 30);
  };

  onMount(() => {
    three = initThree();
    const t = three;
    const pos = [0, 0, 0];
    if (import.meta.env.DEV) window.__v2three = t;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      t.viewport = { w, h };
      t.renderer.setSize(w, h);
      t.labelLayer.resize(w, h, Math.min(window.devicePixelRatio, 2));
      t.camera.aspect = w / h;
      t.camera.updateProjectionMatrix();
      for (const m of t.lineMaterials) m.resolution.set(w, h);
    };
    resize();
    buildRegion(selectedRegion);
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let last = performance.now();
    let raf;
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (playing) {
        let c = clockSec + dt * speed;
        if (c > SERVICE_END) c = SERVICE_START;
        clockSec = c;
      }

      // Camera fly-to animation.
      if (t.camAnim) {
        const a = t.camAnim;
        const k = Math.min(1, (now - a.start) / a.dur);
        const e = k * k * (3 - 2 * k);
        t.camera.position.lerpVectors(a.fromPos, a.toPos, e);
        t.controls.target.lerpVectors(a.fromTgt, a.toTgt, e);
        if (k >= 1) t.camAnim = null;
      }

      for (const entry of t.perLine.values()) {
        if (!entry.group.visible || !showTrains) {
          entry.trainGeom.setDrawRange(0, 0);
          continue;
        }
        let n = 0;
        const path = entry.model.paths[entry.model.mainPath];
        trainsAt(entry.model, clockSec, (s) => {
          if (n >= entry.cap) return;
          pointAt(path, s, pos);
          entry.trainArr[n * 3] = pos[0];
          entry.trainArr[n * 3 + 1] = pos[1];
          entry.trainArr[n * 3 + 2] = pos[2];
          n++;
        });
        entry.trainGeom.attributes.position.needsUpdate = true;
        entry.trainGeom.setDrawRange(0, n);
      }

      // Zoom-dependent station visibility and marker sizing (v1-style):
      // px per scene-meter at the orbit target stands in for v1's
      // pixels-per-degree density.
      const dist = t.camera.position.distanceTo(t.controls.target);
      const pxPerM =
        t.labelLayer.height /
        (2 * dist * Math.tan((t.camera.fov * Math.PI) / 360));
      const stationsOn = forceShowStations || pxPerM > STATION_SHOW_PX_PER_M;
      const stationSize =
        7 *
        Math.min(4, Math.max(0.7, Math.sqrt(pxPerM / STATION_SHOW_PX_PER_M))) *
        stationSizeMultiplier;
      const trainSize = Math.min(
        6,
        Math.max(5, 7 * Math.pow(pxPerM / TRAIN_BASE_PX_PER_M, 0.4)),
      );
      for (const entry of t.perLine.values()) {
        entry.stations.visible = stationsOn;
        entry.stations.material.size = stationSize;
        entry.trainSolidMat.size = trainSize;
        entry.trainGlowMat.size = trainSize + 3;
      }

      t.controls.update();
      t.renderer.render(t.scene, t.camera);

      const visibleKeys = new Set();
      for (const [key, entry] of t.perLine) {
        if (entry.group.visible) visibleKeys.add(key);
      }
      t.labelLayer.draw(t.camera, {
        tier: labelTier,
        exaggeration,
        visibleKeys,
      });
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      t.renderer.dispose();
      t.renderer.domElement.remove();
    };
  });

  // ---- reactive scene updates ----
  $effect(() => {
    if (!three) return;
    for (const entry of three.perLine.values()) {
      entry.group.visible = isEntryVisible(entry.model.meta);
    }
  });

  // Refit the camera whenever the visible-line selection changes: frame the
  // selected company/line network, or return to the region overview.
  let lastFitKey = "";
  $effect(() => {
    const key = `${selectedRegion}|${selectedCompany ?? ""}|${selectedLine ?? ""}`;
    if (!three || regionBuilding) {
      lastFitKey = key;
      return;
    }
    if (key === lastFitKey) return;
    lastFitKey = key;
    if (selectedCompany) fitToVisible();
    else setCamera("bird");
  });
  $effect(() => {
    if (!three?.depthGroup) return;
    three.depthGroup.scale.y = exaggeration;
  });
  $effect(() => {
    if (!three?.grid) return;
    three.grid.visible = showGrid;
    three.controls.autoRotate = autoRotate;
    three.controls.autoRotateSpeed = 0.6;
    for (const entry of three.perLine.values()) {
      entry.pillars.visible = showPillars;
    }
  });
  $effect(() => {
    if (!three) return;
    for (const entry of three.perLine.values()) {
      for (const halo of entry.halos) halo.visible = styleGlow;
      entry.trains.material = styleGlow
        ? entry.trainGlowMat
        : entry.trainSolidMat;
    }
  });

  // Camera presets scale with the region's fitted radius.
  const setCamera = (preset, instant = false) => {
    if (!three) return;
    const { regionScale: R } = three;
    let pos = null;
    let tgt = null;
    if (preset === "bird") {
      pos = new THREE.Vector3(0, 0.475 * R, 0.625 * R);
      tgt = new THREE.Vector3(0, 0, -0.0375 * R);
    } else if (preset === "top") {
      pos = new THREE.Vector3(0, 1.2 * R, 1);
      tgt = new THREE.Vector3(0, 0, 0);
    } else if (preset === "side") {
      pos = new THREE.Vector3(0.025 * R, 0.03 * R, 0.85 * R);
      tgt = new THREE.Vector3(0, -300, 0);
    } else if (preset === "below") {
      pos = new THREE.Vector3(0.2 * R, -0.35 * R, 0.4 * R);
      tgt = new THREE.Vector3(0, 0, 0);
    }
    if (pos) flyTo(pos, tgt, instant);
  };

  const zoomBy = (factor) => {
    if (!three) return;
    const { camera, controls } = three;
    camera.position
      .sub(controls.target)
      .multiplyScalar(factor)
      .add(controls.target);
  };

  const scrub = (e) => {
    clockSec = Number(e.target.value);
  };
</script>

<div
  class="v2-root theme-dark fixed inset-0 overflow-hidden bg-[#04060c] text-[#dbe4f5]"
>
  <div class="viewport absolute inset-0" bind:this={container}>
    <canvas
      class="absolute inset-0 w-full h-full z-[2] pointer-events-none"
      bind:this={labelCanvas}
    ></canvas>
  </div>

  {#if regionBuilding}
    <div
      class="absolute inset-0 z-[5] flex items-center justify-center bg-[rgba(4,6,12,0.55)] text-[#8fa1c4] text-xs tracking-[0.25em] pointer-events-none"
    >
      路線データを構築中…
    </div>
  {/if}

  <!-- Line/company selector reused from the v1 map -->
  <LineSelector
    {regions}
    {selectedRegion}
    trainCompanyNames={companyList}
    {selectedCompany}
    {selectedLine}
    bind:mapTheme
    onselectregion={selectRegion}
    onselectcompany={(company) => {
      selectedCompany = company;
      selectedLine = null;
    }}
    onselectline={({ company, line }) => {
      selectedCompany = company;
      selectedLine = line;
    }}
    onselectfullregionmap={() => {
      selectedCompany = null;
      selectedLine = null;
    }}
    onzoomIn={() => zoomBy(0.8)}
    onzoomOut={() => zoomBy(1.25)}
    onreset={() => setCamera("bird")}
  >
    {#snippet footer()}
      <div
        class="border-t border-border px-2.5 py-2 flex flex-col gap-1.5 flex-none"
      >
        <div class="flex items-center gap-2">
          <button
            class="flex items-center justify-center bg-transparent border-none text-primary cursor-pointer w-6 flex-none"
            onclick={() => (playing = !playing)}
            aria-label={playing ? "一時停止" : "再生"}
          >
            {#if playing}
              <Pause size={13} strokeWidth={2.5} />
            {:else}
              <Play size={13} strokeWidth={2.5} />
            {/if}
          </button>
          <div
            class="text-xs font-bold tabular-nums text-primary min-w-11"
          >
            {formatClock(clockSec)}
          </div>
          <input
            class="flex-1 min-w-0 accent-[var(--color-accent-secondary)]"
            type="range"
            min={SERVICE_START}
            max={SERVICE_END}
            step="60"
            value={clockSec}
            oninput={scrub}
          />
        </div>
        <div class="flex items-center gap-1">
          {#each SPEEDS as s (s)}
            <button
              class="flex-1 border border-border text-xxs py-1 rounded-md cursor-pointer {speed ===
              s
                ? 'bg-[#1c3a66] text-primary'
                : 'bg-[var(--color-surface-soft)] text-secondary'}"
              onclick={() => (speed = s)}>×{s}</button
            >
          {/each}
        </div>
      </div>
    {/snippet}

    {#snippet appearanceExtra()}
      <div class="p-3 overflow-y-auto">
        <div
          class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0"
        >
          DEPTH 深さ表現
        </div>
        <div class="flex items-center gap-2 text-xs text-secondary">
          <span class="whitespace-nowrap">強調倍率</span>
          <input
            class="flex-1"
            type="range"
            min="1"
            max="40"
            step="1"
            bind:value={exaggeration}
          />
          <b class="text-accent-secondary">×{exaggeration}</b>
        </div>

        <div
          class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0"
        >
          LABELS 駅名表示
        </div>
        <div class="flex gap-1">
          {#each [["none", "なし"], ["major", "主要駅"], ["all", "全駅"]] as [tier, label] (tier)}
            <button
              class="flex-1 border border-border text-xs py-1 rounded-md cursor-pointer {labelTier ===
              tier
                ? 'bg-[#1c3a66] text-primary'
                : 'bg-[var(--color-surface-soft)] text-secondary'}"
              onclick={() => (labelTier = tier)}>{label}</button
            >
          {/each}
        </div>

        <div
          class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0"
        >
          STATIONS 駅表示
        </div>
        <label
          class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
          ><input type="checkbox" bind:checked={forceShowStations} /> ズームに関係なく表示</label
        >
        <div class="flex items-center gap-2 text-xs text-secondary">
          <span class="whitespace-nowrap">サイズ</span>
          <input
            class="flex-1"
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            bind:value={stationSizeMultiplier}
          />
          <b class="text-accent-secondary">×{stationSizeMultiplier.toFixed(1)}</b>
        </div>

        <div
          class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0"
        >
          DISPLAY 表示
        </div>
        <label
          class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
          ><input type="checkbox" bind:checked={showTrains} /> 列車の運行</label
        >
        <label
          class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
          ><input type="checkbox" bind:checked={styleGlow} /> グロー効果</label
        >
        <label
          class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
          ><input type="checkbox" bind:checked={autoRotate} /> 自動回転</label
        >
        <label
          class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
          ><input type="checkbox" bind:checked={showPillars} /> 模型支柱（地上との接続）</label
        >
        <label
          class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
          ><input type="checkbox" bind:checked={showGrid} /> 地上グリッド</label
        >

        <div
          class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0"
        >
          CAMERA 視点
        </div>
        <div class="grid grid-cols-2 gap-1.5">
          {#each [["bird", "鳥瞰"], ["top", "真上"], ["side", "断面（横）"], ["below", "地底から"]] as [preset, label] (preset)}
            <button
              class="bg-[var(--color-surface-soft)] border border-border text-secondary text-xs py-2 rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)]"
              onclick={() => setCamera(preset)}>{label}</button
            >
          {/each}
        </div>

        <div class="mt-3.5 text-xxs leading-relaxed text-very-muted">
          深さは概算値（実測データではありません）。ダイヤは合成。 データ:
          国土数値情報 (N02-19)
        </div>
      </div>
    {/snippet}
  </LineSelector>
</div>
