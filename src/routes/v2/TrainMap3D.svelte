<svelte:options runes={true} />

<script>
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
  import { Line2 } from "three/addons/lines/Line2.js";
  import { LineGeometry } from "three/addons/lines/LineGeometry.js";
  import { LineMaterial } from "three/addons/lines/LineMaterial.js";

  import LineSelector from "$lib/LineSelector.svelte";
  import { LabelLayer } from "./labels.js";
  import { getTokyoGeoJson } from "$lib/japan-train-lines.js";
  import { getLineColor } from "$lib/line-colors.js";
  import { TOKYO_CENTER, CLIP_RADIUS_M, depthForLine } from "./depth-config.js";
  import { makeProjector, buildLineModel, pointAt } from "./geo.js";
  import {
    trainsAt,
    maxTrains,
    formatClock,
    SERVICE_START,
    SERVICE_END,
  } from "./schedule.js";

  let { railroadGeoJson, stationGeoJson } = $props();

  // ---- UI state ----
  let selectedCompany = $state(null);
  let selectedLine = $state(null);
  let companyList = $state([]);
  let mapTheme = $state("dark"); // bound by LineSelector; scene stays dark
  let exaggeration = $state(15);
  let playing = $state(true);
  let speed = $state(60);
  let clockSec = $state(7.5 * 3600);
  let trainCount = $state(0);
  let showTrains = $state(true);
  let autoRotate = $state(false);
  let showPillars = $state(true);
  let showGrid = $state(true);
  let labelTier = $state("major"); // none | major | all
  let panelOpen = $state(true);
  let stats = $state(null);

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

  const dotTexture = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(16, 16, 12, 0, Math.PI * 2);
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

  const buildScene = () => {
    const project = makeProjector(TOKYO_CENTER);

    // Same Tokyo network definition as the v1 map.
    const tokyoRails = getTokyoGeoJson(railroadGeoJson).features;
    const tokyoStations = getTokyoGeoJson(stationGeoJson, railroadGeoJson)
      .features;

    // Clip to the scene radius: matched lines can run far beyond Tokyo
    // (Tokaido, Utsunomiya, ...).
    const withinRadius = (f) =>
      f.geometry.coordinates.some(([lon, lat]) => {
        const [x, z] = project(lon, lat);
        return Math.hypot(x, z) < CLIP_RADIUS_M;
      });

    const railByKey = new Map();
    for (const f of tokyoRails) {
      if (!withinRadius(f)) continue;
      const key = `${f.properties["運営会社"]}::${f.properties["路線名"]}`;
      if (!railByKey.has(key)) railByKey.set(key, []);
      railByKey.get(key).push(f);
    }
    const stationsByKey = new Map();
    for (const f of tokyoStations) {
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
      const model = buildLineModel(meta, rails, stationsByKey.get(key) || [], project);
      if (model) models.push(model);
    }

    // Company -> lines list for the LineSelector, prioritized like v1.
    const byCompany = new Map();
    for (const m of models) {
      if (!byCompany.has(m.meta.company)) byCompany.set(m.meta.company, []);
      byCompany.get(m.meta.company).push(m.meta.line);
    }
    const companies = [...byCompany.keys()].sort(
      (a, b) => byCompany.get(b).length - byCompany.get(a).length
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

    let deepest = null;
    let highest = null;
    for (const m of models)
      for (const st of m.stations) {
        if (st.s === null) continue;
        if (!deepest || st.y < deepest.y)
          deepest = { name: st.name, y: st.y, line: m.meta.line };
        if (!highest || st.y > highest.y)
          highest = { name: st.name, y: st.y, line: m.meta.line };
      }
    stats = { deepest, highest };

    // ---- three.js scene ----
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060c);
    scene.fog = new THREE.Fog(0x04060c, 45000, 140000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(50, 1, 10, 300000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.95;
    camera.position.set(0, 19000, 25000);
    controls.target.set(0, 0, -1500);

    const grid = new THREE.GridHelper(84000, 84, 0x1a2a52, 0x0b1226);
    grid.position.y = -2;
    scene.add(grid);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(84000, 84000),
      new THREE.MeshBasicMaterial({
        color: 0x070b16,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.renderOrder = 1;
    scene.add(plane);

    const depthGroup = new THREE.Group();
    depthGroup.scale.y = exaggeration;
    scene.add(depthGroup);

    const glow = glowTexture();
    const dot = dotTexture();
    const lineMaterials = [];
    const perLine = new Map(); // key -> {group, trains, ...}

    for (const model of models) {
      const meta = model.meta;
      const color = new THREE.Color(meta.color);
      const group = new THREE.Group();

      for (const path of model.paths) {
        const geom = new LineGeometry();
        geom.setPositions(Array.from(path.positions));
        const core = new LineMaterial({ color, linewidth: 2 });
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
        coreLine.computeLineDistances();
        haloLine.computeLineDistances();
        group.add(coreLine, haloLine);
      }

      const stPos = [];
      for (const st of model.stations) {
        if (st.s === null) continue;
        stPos.push(st.x, st.y, st.z);
      }
      const stGeom = new THREE.BufferGeometry();
      stGeom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(stPos, 3)
      );
      const stations = new THREE.Points(
        stGeom,
        new THREE.PointsMaterial({
          color: 0xe8f0ff,
          size: 3.5,
          sizeAttenuation: false,
          map: dot,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
        })
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
        new THREE.Float32BufferAttribute(pillarPos, 3)
      );
      const pillars = new THREE.LineSegments(
        pillarGeom,
        new THREE.LineBasicMaterial({
          color: 0x93a9d1,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
        })
      );
      group.add(pillars);

      const cap = maxTrains(model);
      const trainGeom = new THREE.BufferGeometry();
      const trainArr = new Float32Array(cap * 3);
      const attr = new THREE.BufferAttribute(trainArr, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      trainGeom.setAttribute("position", attr);
      trainGeom.setDrawRange(0, 0);
      const trains = new THREE.Points(
        trainGeom,
        new THREE.PointsMaterial({
          color: color.clone().lerp(new THREE.Color(0xffffff), 0.35),
          size: 12,
          sizeAttenuation: false,
          map: glow,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
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
        pillars,
        cap,
      });
    }

    // Station labels, deduped by name across all lines, drawn on a 2D
    // canvas overlay (see labels.js) instead of per-station DOM nodes.
    const labelLayer = new LabelLayer(labelCanvas);
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
    const rulerX = 26000;
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
      new THREE.Float32BufferAttribute(rulerPos, 3)
    );
    ruler.add(
      new THREE.LineSegments(
        rulerGeom,
        new THREE.LineBasicMaterial({
          color: 0x5b76a8,
          transparent: true,
          opacity: 0.5,
        })
      )
    );
    depthGroup.add(ruler);

    return {
      scene,
      renderer,
      camera,
      controls,
      depthGroup,
      grid,
      plane,
      perLine,
      labelLayer,
      lineMaterials,
    };
  };

  onMount(() => {
    three = buildScene();
    const t = three;
    const pos = [0, 0, 0];
    if (import.meta.env.DEV) window.__v2three = t;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      t.renderer.setSize(w, h);
      t.labelLayer.resize(w, h, Math.min(window.devicePixelRatio, 2));
      t.camera.aspect = w / h;
      t.camera.updateProjectionMatrix();
      for (const m of t.lineMaterials) m.resolution.set(w, h);
    };
    resize();
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

      let total = 0;
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
        total += n;
      }
      trainCount = total;

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
  $effect(() => {
    if (!three) return;
    three.depthGroup.scale.y = exaggeration;
  });
  $effect(() => {
    if (!three) return;
    three.grid.visible = showGrid;
    three.controls.autoRotate = autoRotate;
    three.controls.autoRotateSpeed = 0.6;
    for (const entry of three.perLine.values()) {
      entry.pillars.visible = showPillars;
    }
  });

  const setCamera = (preset) => {
    if (!three) return;
    const { camera, controls } = three;
    if (preset === "bird") {
      camera.position.set(0, 19000, 25000);
      controls.target.set(0, 0, -1500);
    } else if (preset === "top") {
      camera.position.set(0, 48000, 10);
      controls.target.set(0, 0, 0);
    } else if (preset === "side") {
      camera.position.set(1000, 1200, 34000);
      controls.target.set(0, -300, 0);
    } else if (preset === "below") {
      camera.position.set(8000, -14000, 16000);
      controls.target.set(0, 0, 0);
    }
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

<div class="v2-root theme-dark">
  <div class="viewport" bind:this={container}>
    <canvas class="label-canvas" bind:this={labelCanvas}></canvas>
  </div>

  <!-- Line/company selector reused from the v1 map -->
  <LineSelector
    regions={[{ id: "tokyo", name: "Tokyo", nameJa: "東京" }]}
    selectedRegion="tokyo"
    trainCompanyNames={companyList}
    {selectedCompany}
    {selectedLine}
    bind:mapTheme
    onselectregion={() => {}}
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
  />

  <header class="hud header">
    <div class="title">
      <span class="t1">JAPAN</span><span class="t2">TRAIN LINES</span>
      <span class="sub">日本鉄道路線図 — 東京 3D・合成ダイヤ運行 (experimental)</span>
    </div>
    {#if stats}
      <div class="stats">
        <div>
          MAX DEPTH <b>{Math.round(stats.deepest.y)}m</b>
          <span>{stats.deepest.name} ({stats.deepest.line})</span>
        </div>
        <div>
          MAX HEIGHT <b>+{Math.round(stats.highest.y)}m</b>
          <span>{stats.highest.name} ({stats.highest.line})</span>
        </div>
      </div>
    {/if}
  </header>

  <aside class="hud panel" class:closed={!panelOpen}>
    <button class="panel-toggle" onclick={() => (panelOpen = !panelOpen)}>
      {panelOpen ? "×" : "3D"}
    </button>
    {#if panelOpen}
      <div class="panel-body">
        <div class="section-title">DEPTH 深さ表現</div>
        <div class="slider-row">
          <span>強調倍率</span>
          <input type="range" min="1" max="40" step="1" bind:value={exaggeration} />
          <b>×{exaggeration}</b>
        </div>

        <div class="section-title">LABELS 駅名表示</div>
        <div class="seg">
          <button class:active={labelTier === "none"} onclick={() => (labelTier = "none")}>なし</button>
          <button class:active={labelTier === "major"} onclick={() => (labelTier = "major")}>主要駅</button>
          <button class:active={labelTier === "all"} onclick={() => (labelTier = "all")}>全駅</button>
        </div>

        <div class="section-title">DISPLAY 表示</div>
        <label class="toggle-row"><input type="checkbox" bind:checked={showTrains} /> 列車の運行</label>
        <label class="toggle-row"><input type="checkbox" bind:checked={autoRotate} /> 自動回転</label>
        <label class="toggle-row"><input type="checkbox" bind:checked={showPillars} /> 模型支柱（地上との接続）</label>
        <label class="toggle-row"><input type="checkbox" bind:checked={showGrid} /> 地上グリッド</label>

        <div class="section-title">CAMERA 視点</div>
        <div class="cam-grid">
          <button onclick={() => setCamera("bird")}>鳥瞰</button>
          <button onclick={() => setCamera("top")}>真上</button>
          <button onclick={() => setCamera("side")}>断面（横）</button>
          <button onclick={() => setCamera("below")}>地底から</button>
        </div>

        <div class="footnote">
          深さは概算値（実測データではありません）。ダイヤは合成。
          データ: 国土数値情報 (N02-19)
        </div>
      </div>
    {/if}
  </aside>

  <div class="hud playbar">
    <button class="play" onclick={() => (playing = !playing)}>
      {playing ? "❚❚" : "▶"}
    </button>
    <div class="clock">{formatClock(clockSec)}</div>
    <input
      class="scrubber"
      type="range"
      min={SERVICE_START}
      max={SERVICE_END}
      step="60"
      value={clockSec}
      oninput={scrub}
    />
    <div class="speeds">
      {#each SPEEDS as s (s)}
        <button class:active={speed === s} onclick={() => (speed = s)}>×{s}</button>
      {/each}
    </div>
    <div class="running">
      <b>{Math.round(trainCount)}</b><span>運行中</span>
    </div>
  </div>
</div>

<style>
  .v2-root {
    position: fixed;
    inset: 0;
    background: #04060c;
    color: #dbe4f5;
    font-family: "Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", Meiryo,
      sans-serif;
    overflow: hidden;
  }
  .viewport {
    position: absolute;
    inset: 0;
  }
  .viewport :global(canvas) {
    display: block;
  }
  .label-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }

  .hud {
    position: absolute;
    z-index: 10;
  }

  /* Header (top-right, leaves top-left to the LineSelector) */
  .header {
    top: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    padding: 16px 20px;
    pointer-events: none;
    text-align: right;
  }
  .title .t1 {
    font-weight: 800;
    letter-spacing: 0.35em;
    font-size: 16px;
    color: #f4f7ff;
  }
  .title .t2 {
    font-weight: 800;
    letter-spacing: 0.35em;
    font-size: 16px;
    color: #4da3ff;
    margin-left: 10px;
  }
  .title .sub {
    display: block;
    margin-top: 4px;
    font-size: 10px;
    color: #7484a3;
    letter-spacing: 0.15em;
  }
  .stats {
    text-align: right;
    font-size: 10px;
    letter-spacing: 0.12em;
    color: #7484a3;
  }
  .stats b {
    color: #4da3ff;
    font-size: 11px;
  }
  .stats span {
    color: #aab8d4;
    margin-left: 6px;
  }

  /* Right-side 3D controls panel */
  .panel {
    top: 110px;
    right: 16px;
    max-height: calc(100% - 220px);
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }
  .panel-toggle {
    background: rgba(13, 20, 38, 0.85);
    color: #aab8d4;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    font-size: 10px;
    letter-spacing: 0.15em;
    padding: 4px 10px;
    cursor: pointer;
  }
  .panel-body {
    margin-top: 6px;
    width: 210px;
    overflow-y: auto;
    background: rgba(10, 15, 30, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 12px;
    backdrop-filter: blur(8px);
  }
  .section-title {
    font-size: 9px;
    letter-spacing: 0.25em;
    color: #5c6c8f;
    margin: 14px 0 6px;
  }
  .section-title:first-child {
    margin-top: 0;
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10px;
    color: #8fa1c4;
  }
  .slider-row span {
    white-space: nowrap;
  }
  .slider-row input {
    flex: 1;
  }
  .slider-row b {
    color: #4da3ff;
  }
  .seg {
    display: flex;
    gap: 4px;
  }
  .seg button {
    flex: 1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #8fa1c4;
    font-size: 10px;
    padding: 4px 0;
    border-radius: 6px;
    cursor: pointer;
  }
  .seg button.active {
    background: #1c3a66;
    color: #eaf2ff;
    border-color: #2f5a9b;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    color: #c3cfe6;
    padding: 3px 0;
    cursor: pointer;
  }
  .cam-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .cam-grid button {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #c3cfe6;
    font-size: 11px;
    padding: 7px 0;
    border-radius: 8px;
    cursor: pointer;
  }
  .cam-grid button:hover {
    background: rgba(255, 255, 255, 0.09);
  }
  .footnote {
    margin-top: 14px;
    font-size: 9px;
    line-height: 1.6;
    color: #4a587a;
  }

  /* Bottom playback bar */
  .playbar {
    left: 50%;
    transform: translateX(-50%);
    bottom: 16px;
    display: flex;
    align-items: center;
    gap: 14px;
    background: rgba(10, 15, 30, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 10px 16px;
    backdrop-filter: blur(8px);
    width: min(760px, calc(100% - 32px));
  }
  .play {
    background: none;
    border: none;
    color: #eaf2ff;
    font-size: 14px;
    cursor: pointer;
    width: 28px;
  }
  .clock {
    font-size: 22px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #f4f7ff;
    min-width: 74px;
  }
  .scrubber {
    flex: 1;
    accent-color: #4da3ff;
  }
  .speeds {
    display: flex;
    gap: 4px;
  }
  .speeds button {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #8fa1c4;
    font-size: 10px;
    padding: 4px 7px;
    border-radius: 6px;
    cursor: pointer;
  }
  .speeds button.active {
    background: #1c3a66;
    color: #eaf2ff;
  }
  .running {
    text-align: center;
    min-width: 52px;
  }
  .running b {
    display: block;
    color: #ffb144;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .running span {
    font-size: 9px;
    color: #5c6c8f;
    letter-spacing: 0.15em;
  }

  @media (max-width: 720px) {
    .stats {
      display: none;
    }
    .panel-body {
      width: 180px;
    }
    .clock {
      font-size: 16px;
      min-width: 56px;
    }
  }
</style>
