<svelte:options runes={true} />

<script>
  import { onMount } from "svelte";
  import { loadTrainLines, drawTrainLine } from "$lib/japan-train-lines.js";
  import { stationNameMapping } from "$lib/line-name-mapping.js";
  import { regions as allRegions } from "$lib/regions.js";
  import LineSelector from "$lib/LineSelector.svelte";

  let {
    railroadGeoJsonUrl = "/railroad.geojson",
    stationGeoJsonUrl = null,
    japanOutlineGeoJsonUrl = null,
    mapPadding = 0.05,
  } = $props();

  let viewerEl = $state();
  let svgViewerEl = $state();
  let hoveredStation = $state(null);
  let regions = $state([]);
  let regionDataMap = {};
  let trainCompanyNames = $state([]);
  let selectedRegion = $state("tokyo");
  let selectedCompany = $state(null);
  let selectedLine = $state(null);
  let urlSyncReady = $state(false);
  let showLineColors = $state(true);
  let showBaseMapOutline = $state(true);
  let forceShowStations = $state(false);
  let stationSizeMultiplier = $state(1);
  let mapTheme = $state("dark");
  let showRegionPolygon = $state(false);
  let mapInfo = $state(null);

  // Pan & Zoom State
  let zoom = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isDragging = $state(false);

  let startX = 0;
  let startY = 0;
  let initPanX = 0;
  let initPanY = 0;

  // Touch double-tap state
  let lastTapTime = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  // Touch pinch-to-zoom state
  let initialPinchDistance = 0;
  let initialPinchZoom = 0;
  let initialPinchMapX = 0;
  let initialPinchMapY = 0;
  let initialPinchSvgX = 0;
  let initialPinchSvgY = 0;

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
    const showStations =
      forceShowStations || computePixelsPerDegree(mapInfo, zoom) > 800;
    const adjustedStationRadius =
      (stationRadiusForZoom(zoom) * stationSizeMultiplier) / screenScale;
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

    const params = new URLSearchParams(window.location.search);
    const urlRegion = params.get("region");
    const urlCompany = params.get("company");
    const urlLine = params.get("line");
    if (urlRegion) selectedRegion = urlRegion;
    trainCompanyNames = regionDataMap[selectedRegion] || [];
    if (urlCompany) selectedCompany = urlCompany;
    if (urlLine) selectedLine = urlLine;

    // Apply the initial view for the starting region (unless a company/line is pre-selected from URL)
    if (!selectedCompany && !selectedLine) {
      regionViewPending = selectedRegion;
    }

    urlSyncReady = true;
    registerKeyboardShortcuts();
  });

  // Sync selection state to URL
  $effect(() => {
    if (!urlSyncReady) return;
    const params = new URLSearchParams();
    params.set("region", selectedRegion);
    if (selectedCompany) params.set("company", selectedCompany);
    if (selectedLine) params.set("line", selectedLine);
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}?${params}`,
    );
  });

  // Redraw map when region, company, line, or display options change
  $effect(() => {
    if (viewerEl && regions.length > 0) {
      mapInfo = drawTrainLine(
        selectedRegion,
        selectedCompany,
        selectedLine,
        viewerEl,
        640,
        { showLineColors, showBaseMapOutline, mapTheme, padding: mapPadding },
      );
      // Apply the region's initialView once after a region change (non-reactive
      // flag so reading it here doesn't add it as an effect dependency).
      const pending = regionViewPending;
      if (pending) {
        regionViewPending = null;
        applyRegionInitialView(pending, mapInfo);
      }
    }
  });

  // Apply pan/zoom transform when any relevant state changes
  $effect(() => {
    // Explicitly track all dependencies that affect the transform
    void [zoom, panX, panY, forceShowStations, stationSizeMultiplier, mapInfo];
    if (viewerEl) applyMapTransform();
  });

  // Draw or remove the debug region polygon overlay (one path per prefecture)
  $effect(() => {
    const mapLayer = viewerEl?.querySelector("[data-map-layer]");
    mapLayer
      ?.querySelectorAll(".debug-region-polygon")
      .forEach((el) => el.remove());
    if (!showRegionPolygon || !mapInfo || !mapLayer) return;

    const region = allRegions.find((r) => r.id === selectedRegion);
    if (!region?.prefectures) return;

    const { bounds, svgWidth, svgHeight } = mapInfo;

    const project = ([lng, lat]) => {
      const x =
        ((lng - bounds.min_x) / (bounds.max_x - bounds.min_x)) * svgWidth;
      const y =
        svgHeight -
        ((lat - bounds.min_y) / (bounds.max_y - bounds.min_y)) * svgHeight;
      return `${x},${y}`;
    };

    const renderRing = (ring) => {
      const el = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon",
      );
      el.setAttribute("class", "debug-region-polygon");
      el.setAttribute("points", ring.map(project).join(" "));
      el.setAttribute("fill", "rgba(255,80,80,0.06)");
      el.setAttribute("stroke", "rgba(255,80,80,0.8)");
      el.setAttribute("stroke-width", "2");
      el.setAttribute("stroke-dasharray", "10 5");
      el.setAttribute("vector-effect", "non-scaling-stroke");
      mapLayer.appendChild(el);
    };

    fetch("/prefecture-polygons.json")
      .then((r) => r.json())
      .then((prefPolygons) => {
        for (const code of region.prefectures) {
          const geom = prefPolygons[code];
          if (!geom) continue;
          if (geom.type === "Polygon") {
            renderRing(geom.coordinates[0]);
          } else if (geom.type === "MultiPolygon") {
            geom.coordinates.forEach((poly) => renderRing(poly[0]));
          }
        }
      });
  });

  const handleReset = () => {
    zoom = 1;
    panX = 0;
    panY = 0;
  };

  // Plain (non-reactive) flag: set before selectedRegion changes so the
  // drawing effect can apply the region's initialView once after redraw.
  let regionViewPending = null;

  const applyRegionInitialView = (regionId, info) => {
    const region = allRegions.find((r) => r.id === regionId);
    if (region?.initialView && info) {
      const { center, zoom: targetZoom } = region.initialView;
      // Project lat/lng to SVG user units (same formula as train-line-svg.js)
      const mx =
        ((center.lng - info.bounds.min_x) /
          (info.bounds.max_x - info.bounds.min_x)) *
        info.svgWidth;
      const my =
        info.svgHeight -
        ((center.lat - info.bounds.min_y) /
          (info.bounds.max_y - info.bounds.min_y)) *
          info.svgHeight;
      // SVG is CSS-centered, so viewport center = (svgWidth/2, svgHeight/2)
      zoom = targetZoom;
      panX = info.svgWidth / 2 - mx * targetZoom;
      panY = info.svgHeight / 2 - my * targetZoom;
    } else {
      handleReset();
    }
  };

  const zoomToPoint = (point, factor) => {
    const x = (point.x - panX) / zoom;
    const y = (point.y - panY) / zoom;
    let newZoom = zoom * factor;
    // Limit zoom scale range
    //newZoom = Math.max(0.15, Math.min(20, newZoom));
    const pxPerDeg = computePixelsPerDegree(mapInfo, newZoom);
    if (pxPerDeg < 30) newZoom = zoom;
    if (pxPerDeg > 10000) newZoom = zoom;

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

  const getTouchDistance = (t1, t2) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      const dt = now - lastTapTime;
      const dx = touch.clientX - lastTapX;
      const dy = touch.clientY - lastTapY;
      if (dt < 300 && Math.hypot(dx, dy) < 30) {
        e.preventDefault();
        zoomToPoint(clientPointToSvgPoint(touch.clientX, touch.clientY), 2);
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;

      hoveredStation = null;
      const point = clientPointToSvgPoint(touch.clientX, touch.clientY);
      isDragging = true;
      startX = point.x;
      startY = point.y;
      initPanX = panX;
      initPanY = panY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      hoveredStation = null;
      const [t1, t2] = [e.touches[0], e.touches[1]];
      initialPinchDistance = getTouchDistance(t1, t2);
      initialPinchZoom = zoom;
      const midClientX = (t1.clientX + t2.clientX) / 2;
      const midClientY = (t1.clientY + t2.clientY) / 2;
      const center = clientPointToSvgPoint(midClientX, midClientY);
      initialPinchSvgX = center.x;
      initialPinchSvgY = center.y;
      initialPinchMapX = (center.x - panX) / zoom;
      initialPinchMapY = (center.y - panY) / zoom;
    }
  };

  const handleTouchMove = (e) => {
    if (hoveredStation) hoveredStation = null;
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const point = clientPointToSvgPoint(touch.clientX, touch.clientY);
      panX = initPanX + (point.x - startX);
      panY = initPanY + (point.y - startY);
    } else if (e.touches.length === 2) {
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const newDist = getTouchDistance(t1, t2);
      let newZoom = initialPinchZoom * (newDist / initialPinchDistance);
      const pxPerDeg = computePixelsPerDegree(mapInfo, newZoom);
      if (pxPerDeg < 30 || pxPerDeg > 10000) newZoom = zoom;
      panX = initialPinchSvgX - initialPinchMapX * newZoom;
      panY = initialPinchSvgY - initialPinchMapY * newZoom;
      zoom = newZoom;
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2) {
      isDragging = false;
    }
  };

  const selectRegion = (regionId) => {
    regionViewPending = regionId;
    selectedRegion = regionId;
    trainCompanyNames = regionDataMap[selectedRegion] || [];
    selectedCompany = null;
    selectedLine = null;
    handleReset(); // reset immediately; applyRegionInitialView overrides after redraw
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
    class="px-4 py-4 bg-panel-background backdrop-blur-md border-b border-border flex justify-between items-center z-10 transition-colors duration-200"
  >
    <div
      class="flex items-baseline justify-between gap-4 md:text-md text-xs font-medium"
    >
      <h1 class="text-primary">Japan Train Lines</h1>
      <span class="text-primary">日本鉄道路線図</span>
      <span class="text-secondary">
        by
        <a href="http://liquidx.net" class="underline">@liquidx</a></span
      >
    </div>
  </header>

  <!-- Interactive Map Viewport -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <!-- svelte-ignore a11y_mouse_events_have_key_events -->
  <div
    id="svg-viewer"
    role="application"
    aria-label="Interactive train map viewer"
    bind:this={svgViewerEl}
    onmousedown={handleMouseDown}
    ondblclick={handleDoubleClick}
    onwheel={handleWheel}
    onmouseover={handleStationMouseOver}
    onmouseout={handleStationMouseOut}
    ontouchstart={handleTouchStart}
    ontouchmove={handleTouchMove}
    ontouchend={handleTouchEnd}
    class="map-viewport flex-1 relative overflow-hidden select-none touch-none transition-colors duration-200"
    style="cursor: {isDragging ? 'grabbing' : 'grab'};"
  >
    <div
      id="svg-content-wrapper"
      bind:this={viewerEl}
      class="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"
      style="--zoom: {zoom};"
    ></div>

    <!-- HUD Overlay Controls -->
    <LineSelector
      {regions}
      {trainCompanyNames}
      {selectedRegion}
      {selectedCompany}
      {selectedLine}
      onselectregion={selectRegion}
      onselectcompany={selectCompany}
      onselectline={(d) => selectLine(d.company, d.line)}
      onselectfullregionmap={selectFullRegionMap}
      bind:mapTheme
      bind:showLineColors
      bind:showBaseMapOutline
      bind:forceShowStations
      bind:stationSizeMultiplier
      bind:showRegionPolygon
      onzoomIn={zoomIn}
      onzoomOut={zoomOut}
      onreset={handleReset}
    />

    <!-- Station Tooltip -->
    {#if hoveredStation}
      <div
        class="absolute z-20 pointer-events-none bg-panel-background border border-border rounded-lg px-2.5 py-1.5 shadow-[var(--shadow-panel)] text-sm font-medium text-primary whitespace-nowrap"
        style="left: {hoveredStation.x}px; top: {hoveredStation.y}px; transform: translate(-50%, calc(-100% - 10px));"
      >
        {hoveredStation.name}
        {#if hoveredStation.nameEn}
          <span class="block text-[11px] font-normal text-secondary mt-0.5"
            >{hoveredStation.nameEn}</span
          >
        {/if}
        <span class="block text-[10px] font-normal text-muted mt-0.5"
          >{hoveredStation.lineName}</span
        >
      </div>
    {/if}
  </div>
</div>
