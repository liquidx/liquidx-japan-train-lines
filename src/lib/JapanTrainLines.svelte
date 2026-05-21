<script>
  import { onMount } from "svelte";
  import { loadTrainLines, drawTrainLine } from "$lib/japan-train-lines.js";
  import { stationNameMapping } from "$lib/line-name-mapping.js";
  import MapControls from "$lib/MapControls.svelte";
  import ControlsPanel from "$lib/ControlsPanel.svelte";

  export let railroadGeoJsonUrl = "/railroad.geojson";
  export let stationGeoJsonUrl = null;
  export let japanOutlineGeoJsonUrl = null;
  let viewerEl;
  let svgViewerEl;
  let hoveredStation = null;
  let regions = [];
  let regionDataMap = {};
  let trainCompanyNames = [];
  let selectedRegion = "tokyo";
  let selectedCompany = null;
  let selectedLine = null;
  let showLineColors = true;
  let showBaseMapOutline = true;
  let mapTheme = "dark";
  let mapInfo = null;

  // Pan & Zoom State
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;

  let startX = 0;
  let startY = 0;
  let initPanX = 0;
  let initPanY = 0;
  const lineStrokeWidth = 2;
  const minStationRadius = lineStrokeWidth * 0.1;
  const maxStationRadius = lineStrokeWidth * 1.5;

  const stationRadiusForZoom = (currentZoom) => {
    const zoomStep = Math.log2(Math.max(currentZoom, 0.25));
    const radius = lineStrokeWidth * (1.2 + zoomStep * 0.5);
    return Math.max(minStationRadius, Math.min(maxStationRadius, radius));
  };

  const getSvgElement = () => viewerEl?.querySelector("svg");

  const clientPointToSvgPoint = (clientX, clientY) => {
    const svg = getSvgElement();
    if (!svg) {
      return { x: clientX, y: clientY };
    }

    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;

    const screenCtm = svg.getScreenCTM();
    if (!screenCtm) {
      return { x: clientX, y: clientY };
    }

    return point.matrixTransform(screenCtm.inverse());
  };

  const getSvgViewportCenter = () => {
    const svg = getSvgElement();
    if (!svg) {
      return { x: 0, y: 0 };
    }

    const rect = svg.getBoundingClientRect();
    return clientPointToSvgPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
  };

  const computePixelsPerDegree = (info, currentZoom) =>
    info
      ? (info.svgWidth / (info.bounds.max_x - info.bounds.min_x)) * currentZoom
      : 0;

  const applyMapTransform = () => {
    const mapLayer = viewerEl?.querySelector("[data-map-layer]");
    if (!mapLayer) return;

    mapLayer.setAttribute(
      "transform",
      `translate(${panX} ${panY}) scale(${zoom})`,
    );

    const screenCtm = mapLayer.getScreenCTM();
    const screenScale = screenCtm ? Math.hypot(screenCtm.a, screenCtm.b) : zoom;
    const showStations = computePixelsPerDegree(mapInfo, zoom) > 600;
    const adjustedStationRadius = stationRadiusForZoom(zoom) / screenScale;
    for (const station of mapLayer.querySelectorAll(".station-dot")) {
      station.setAttribute("r", adjustedStationRadius);
      station.style.display = showStations ? "" : "none";
    }
  };

  onMount(async () => {
    let data = await loadTrainLines({
      railroadGeoJsonUrl,
      stationGeoJsonUrl,
      japanOutlineGeoJsonUrl,
    });
    regions = data.regions;
    regionDataMap = data.regionData;
    trainCompanyNames = regionDataMap[selectedRegion] || [];
    registerKeyboardShortcuts();
  });

  // Reactive redraw whenever region, company, line, or render option changes
  $: if (viewerEl && regions.length > 0) {
    mapInfo = drawTrainLine(
      selectedRegion,
      selectedCompany,
      selectedLine,
      viewerEl,
      640,
      { showLineColors, showBaseMapOutline, mapTheme },
    );
    applyMapTransform();
  }

  $: mapTransform = { zoom, panX, panY };
  $: if (viewerEl && mapTransform) {
    applyMapTransform();
  }

  // World-coordinate zoom: screen pixels per degree of longitude.
  // Increases as you zoom in, independent of SVG dimensions or region extents.
  $: pixelsPerDegree = computePixelsPerDegree(mapInfo, zoom);

  const handleReset = () => {
    zoom = 1;
    panX = 0;
    panY = 0;
  };

  const zoomToPoint = (point, factor) => {
    const x = (point.x - panX) / zoom;
    const y = (point.y - panY) / zoom;
    let newZoom = zoom * factor;
    // Limit zoom scale range
    newZoom = Math.max(0.15, Math.min(20, newZoom));
    panX = point.x - x * newZoom;
    panY = point.y - y * newZoom;
    zoom = newZoom;
  };

  const zoomIn = () => {
    if (!viewerEl) return;
    zoomToPoint(getSvgViewportCenter(), 1.3);
  };

  const zoomOut = () => {
    if (!viewerEl) return;
    zoomToPoint(getSvgViewportCenter(), 1 / 1.3);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.15;

    const factor = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    zoomToPoint(clientPointToSvgPoint(e.clientX, e.clientY), factor);
  };

  const handleStationMouseOver = (e) => {
    if (!e.target.classList.contains("station-dot")) return;
    const containerRect = svgViewerEl.getBoundingClientRect();
    const name = e.target.getAttribute("data-station-name");
    hoveredStation = {
      name,
      nameEn: stationNameMapping[name] ?? null,
      lineName: e.target.getAttribute("data-line-name"),
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    };
  };

  const handleStationMouseOut = (e) => {
    if (e.target.classList.contains("station-dot")) {
      hoveredStation = null;
    }
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    if (e.target.closest(".hud-controls")) return;

    hoveredStation = null;
    isDragging = true;
    const point = clientPointToSvgPoint(e.clientX, e.clientY);
    startX = point.x;
    startY = point.y;
    initPanX = panX;
    initPanY = panY;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const point = clientPointToSvgPoint(e.clientX, e.clientY);
    const dx = point.x - startX;
    const dy = point.y - startY;
    panX = initPanX + dx;
    panY = initPanY + dy;
  };

  const handleMouseUp = () => {
    isDragging = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClick = (e) => {
    if (e.target.closest(".hud-controls")) return;
    zoomToPoint(clientPointToSvgPoint(e.clientX, e.clientY), 2);
  };

  const selectRegion = (regionId) => {
    selectedRegion = regionId;
    trainCompanyNames = regionDataMap[selectedRegion] || [];
    selectedCompany = null;
    selectedLine = null;
    handleReset();
  };

  const selectLine = (company, line) => {
    selectedCompany = company;
    selectedLine = line;
    handleReset();
  };

  const selectCompany = (company) => {
    selectedCompany = company;
    selectedLine = null;
    handleReset();
  };

  const selectFullRegionMap = () => {
    selectedCompany = null;
    selectedLine = null;
    handleReset();
  };

  const registerKeyboardShortcuts = () => {
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        getNext();
        handleReset();
      }
    });
  };

  const getNext = () => {
    let nextLine = getNextLine();
    if (selectedLine === nextLine) {
      selectedCompany = getNextCompany();
      selectedLine = getNextLine();
    } else {
      selectedLine = nextLine;
    }
  };

  const getNextLine = () => {
    let company = trainCompanyNames.find(
      (company) => company.company === selectedCompany,
    );
    if (!company) return selectedLine;
    let lineIndex = company.lines.indexOf(selectedLine);
    if (lineIndex === company.lines.length - 1) {
      return selectedLine;
    } else {
      return company.lines[lineIndex + 1];
    }
  };

  const getNextCompany = () => {
    let companyIndex = trainCompanyNames.findIndex(
      (company) => company.company === selectedCompany,
    );
    if (companyIndex === -1 || companyIndex === trainCompanyNames.length - 1) {
      return trainCompanyNames[0]?.company || selectedCompany;
    } else {
      return trainCompanyNames[companyIndex + 1].company;
    }
  };
</script>

<div
  id="app-container"
  class="theme-{mapTheme} flex flex-col h-screen w-screen bg-background overflow-hidden transition-colors duration-200"
>
  <!-- Title / Header Overlay -->
  <header
    class="h-16 bg-panel-background backdrop-blur-md border-b border-border flex justify-between items-center px-6 z-10 transition-colors duration-200"
  >
    <div class="flex items-center gap-2.5">
      <span class="text-xl">🚇</span>
      <h1 class="text-md font-semibold m-0 text-primary">
        Japan Train Line Maps
      </h1>
      <span class="text-xs text-muted ml-1.5 pl-3 border-l border-border"
        >鉄道路線図</span
      >
    </div>

    <div class="flex items-center gap-4">
      {#if selectedCompany}
        <div
          class="flex items-center gap-2 bg-[var(--color-surface-soft)] px-3.5 py-1.5 rounded-full border border-border text-xs"
        >
          <span class="text-accent-secondary">{selectedCompany}</span>
          {#if selectedLine}
            <span class="text-muted">→</span>
            <span class="text-secondary">{selectedLine}</span>
          {/if}
        </div>
      {:else}
        <div
          class="flex items-center gap-2 bg-[var(--color-surface-soft)] px-3.5 py-1.5 rounded-full border border-border text-xs"
        >
          <span class="font-medium text-accent-primary">
            {regions.find((r) => r.id === selectedRegion)?.name || "All Japan"} Network
          </span>
        </div>
      {/if}
    </div>
  </header>

  <!-- Interactive Map Viewport -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div
    id="svg-viewer"
    role="application"
    aria-label="Interactive train map viewer"
    bind:this={svgViewerEl}
    on:mousedown={handleMouseDown}
    on:dblclick={handleDoubleClick}
    on:wheel={handleWheel}
    on:mouseover={handleStationMouseOver}
    on:mouseout={handleStationMouseOut}
    class="map-viewport flex-1 relative overflow-hidden select-none touch-none border-b border-border transition-colors duration-200"
    style="cursor: {isDragging ? 'grabbing' : 'grab'};"
  >
    <div
      id="svg-content-wrapper"
      bind:this={viewerEl}
      class="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"
      style="--zoom: {zoom};"
    ></div>

    <!-- HUD Overlay Controls -->
    <MapControls
      bind:mapTheme
      bind:showLineColors
      bind:showBaseMapOutline
      on:zoomIn={zoomIn}
      on:zoomOut={zoomOut}
      on:reset={handleReset}
    />

    <!-- Station Tooltip -->
    {#if hoveredStation}
      <div
        class="absolute z-20 pointer-events-none bg-panel-background border border-border rounded-lg px-2.5 py-1.5 shadow-[var(--shadow-panel)] text-sm font-medium text-primary whitespace-nowrap"
        style="left: {hoveredStation.x}px; top: {hoveredStation.y}px; transform: translate(-50%, calc(-100% - 10px));"
      >
        {hoveredStation.name}
        {#if hoveredStation.nameEn}
          <span class="block text-[11px] font-normal text-secondary mt-0.5">{hoveredStation.nameEn}</span>
        {/if}
        <span class="block text-[10px] font-normal text-muted mt-0.5"
          >{hoveredStation.lineName}</span
        >
      </div>
    {/if}

    <!-- Keyboard Hint -->
    <div
      class="absolute bottom-5 left-5 text-[11px] text-[var(--color-text-muted)] bg-panel-background px-3 py-1.5 rounded border border-border pointer-events-none"
    >
      Press <kbd
        class="bg-[var(--color-surface-soft)] border border-border rounded px-1 py-[1px] font-inherit text-[var(--color-text-secondary)]"
        >➔</kbd
      > to cycle lines
    </div>
  </div>

  <!-- Controls Panel -->
  <ControlsPanel
    {regions}
    {trainCompanyNames}
    {selectedRegion}
    {selectedCompany}
    {selectedLine}
    on:selectregion={(e) => selectRegion(e.detail)}
    on:selectcompany={(e) => selectCompany(e.detail)}
    on:selectline={(e) => selectLine(e.detail.company, e.detail.line)}
    on:selectfullregionmap={selectFullRegionMap}
  />
</div>
