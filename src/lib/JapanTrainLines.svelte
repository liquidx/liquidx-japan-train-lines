<svelte:options runes={true} />

<script>
  import { onMount } from "svelte";
  import { tweened } from "svelte/motion";
  import { cubicInOut } from "svelte/easing";
  import {
    loadTrainLines,
    getRegionsGeoJson,
    getRegionsStationGeoJson,
    getJapanOutlineGeoJson,
  } from "$lib/japan-train-lines.js";
  import { getTrainLinesLayout } from "$lib/train-line-layout.js";
  import { getLineColor } from "$lib/line-colors.js";
  import { stationNameMapping, companyNameMapping, lineNameMapping } from "$lib/line-name-mapping.js";
  import { regions as allRegions } from "$lib/regions.js";
  import { joinSegments } from "$lib/train-lines.js";
  import LineSelector from "$lib/LineSelector.svelte";

  let {
    railroadGeoJsonUrl = "/railroad.geojson",
    stationGeoJsonUrl = null,
    japanOutlineGeoJsonUrl = null,
    mapPadding = 0.05,
  } = $props();

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
  let schematicMode = $state(false);

  // Prefectures polygons cache
  let prefPolygons = $state(null);

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

  const getSvgElement = () => svgViewerEl?.querySelector("svg");

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

  // Transition Store
  const transitionProgress = tweened(0, {
    duration: 600,
    easing: cubicInOut,
  });

  let transitionFinished = $state(false);

  $effect(() => {
    transitionFinished = false;
    const target = schematicMode ? 1 : 0;
    transitionProgress.set(target).then(() => {
      if (schematicMode && target === 1) {
        transitionFinished = true;
      }
    });
  });

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

    if (!selectedCompany && !selectedLine) {
      regionViewPending = selectedRegion;
    }

    urlSyncReady = true;
    registerKeyboardShortcuts();

    fetch("/prefecture-polygons.json")
      .then((r) => r.json())
      .then((data) => {
        prefPolygons = data;
      });
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

  // Layout Data Computations (Derived)
  let activeGeoJson = $derived(
    regions.length > 0 ? getRegionsGeoJson()[selectedRegion] : null
  );
  let activeStationGeoJson = $derived(
    regions.length > 0 ? getRegionsStationGeoJson()[selectedRegion] : null
  );
  let japanOutlineGeoJson = $derived(
    regions.length > 0 ? getJapanOutlineGeoJson() : null
  );

  let layoutData = $derived(
    activeGeoJson ? getTrainLinesLayout(
      activeGeoJson,
      activeStationGeoJson,
      selectedRegion,
      selectedCompany,
      selectedLine,
      { padding: mapPadding, schematicMode }
    ) : null
  );

  const max_dim = 640;
  let bounds = $derived(layoutData?.bounds || { min_x: 130, max_x: 145, min_y: 30, max_y: 45 });
  let mapWidth = $derived(bounds.max_x - bounds.min_x);
  let mapHeight = $derived(bounds.max_y - bounds.min_y);

  let svgWidth = $derived(
    mapWidth > mapHeight
      ? max_dim
      : (max_dim / mapHeight) * mapWidth
  );
  let svgHeight = $derived(
    mapWidth > mapHeight
      ? (max_dim / mapWidth) * mapHeight
      : max_dim
  );

  const projectX = (lng) => {
    return ((lng - bounds.min_x) * svgWidth) / mapWidth;
  };

  const projectY = (lat) => {
    return svgHeight - ((lat - bounds.min_y) * svgHeight) / mapHeight;
  };

  // Schematic Layout Settings
  const rowHeight = 75;
  const paddingTop = 40;
  const paddingBottom = 60;
  const paddingLeft = 190;
  const paddingRight = 45;

  let schematicHeight = $derived(
    layoutData ? layoutData.lines.length * rowHeight + paddingTop + paddingBottom : 640
  );

  let currentSvgHeight = $derived(
    svgHeight + (schematicHeight - svgHeight) * $transitionProgress
  );

  let viewBoxString = $derived(
    `0 0 ${svgWidth} ${currentSvgHeight}`
  );

  // Derive final lines and paths coordinates
  let renderedLines = $derived.by(() => {
    if (!layoutData) return [];
    
    return layoutData.lines.map((line, lineIdx) => {
      const ySchematic = lineIdx * rowHeight + rowHeight / 2 + paddingTop;
      const innerWidth = svgWidth - paddingLeft - paddingRight;
      
      const paths = line.paths.map((path, pathIdx) => {
        const coordinates = path.points.map((pt) => {
          const geoX = projectX(pt.coord[0]);
          const geoY = projectY(pt.coord[1]);
          
          const f = line.totalLength > 0 ? pt.distanceAlong / line.totalLength : 0.5;
          const schX = paddingLeft + f * innerWidth;
          const schY = ySchematic;
          
          const x = geoX + (schX - geoX) * $transitionProgress;
          const y = geoY + (schY - geoY) * $transitionProgress;
          
          return [x, y];
        });
        
        const d = coordinates.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt[0]},${pt[1]}`).join(' ');
        
        return {
          id: `path-${line.key}-${pathIdx}`,
          d
        };
      });
      
      const lineNameJa = lineNameMapping[line.line]?.ja || line.line;
      const lineNameEn = lineNameMapping[line.line]?.en || line.line;
      
      const color = getLineColor(line.company, line.line, mapTheme) || "var(--color-map-line-mono)";
      
      return {
        key: line.key,
        company: line.company,
        line: line.line,
        paths,
        ySchematic,
        displayNameJa: lineNameJa,
        displayNameEn: lineNameEn,
        color
      };
    });
  });

  // Calculate reactive zoom scaling for stations
  let screenScale = $derived(zoom);
  let showStations = $derived(
    forceShowStations || computePixelsPerDegree(mapInfo, zoom) > 800 || schematicMode
  );
  let adjustedStationRadius = $derived(
    (stationRadiusForZoom(zoom) * stationSizeMultiplier) / screenScale
  );

  // Derive final stations list
  let renderedStations = $derived.by(() => {
    if (!layoutData) return [];
    
    return layoutData.stations.map((st) => {
      const lineIdx = layoutData.lines.findIndex((l) => l.key === `${st.companyName}::${st.lineName}`);
      if (lineIdx === -1) return null;
      
      const lineObj = renderedLines[lineIdx];
      if (!lineObj) return null;
      
      const ySchematic = lineObj.ySchematic;
      const innerWidth = svgWidth - paddingLeft - paddingRight;
      
      const geoX = projectX(st.coord[0]);
      const geoY = projectY(st.coord[1]);
      
      let schX;
      if (st.numStations > 1) {
        schX = paddingLeft + (st.index / (st.numStations - 1)) * innerWidth;
      } else {
        schX = paddingLeft + innerWidth / 2;
      }
      const schY = ySchematic;
      
      const cx = geoX + (schX - geoX) * $transitionProgress;
      const cy = geoY + (schY - geoY) * $transitionProgress;
      
      const color = showLineColors ? lineObj.color : "var(--color-map-line-mono)";
      
      return {
        id: st.id,
        name: st.name,
        lineName: st.lineName,
        companyName: st.companyName,
        cx,
        cy,
        r: adjustedStationRadius,
        color,
        display: showStations ? "" : "none",
        showLabel: $transitionProgress > 0.6
      };
    }).filter(Boolean);
  });

  // Japan Outline path data
  let japanOutlinePathD = $derived.by(() => {
    if (!japanOutlineGeoJson) return "";
    const geometries = japanOutlineGeoJson.geometries || [];
    const outlineSegments = geometries.map((geom) => ({ geometry: geom }));
    const joined = joinSegments(outlineSegments);

    let combined_d = "";
    for (const feature of joined) {
      let svg_points = "";
      for (const point of feature.geometry.coordinates) {
        const x = projectX(point[0]);
        const y = projectY(point[1]);
        if (!svg_points) {
          svg_points += `M${x},${y} `;
        } else {
          svg_points += `L${x},${y} `;
        }
      }
      if (svg_points) {
        svg_points += "Z";
        combined_d += svg_points + " ";
      }
    }
    return combined_d.trim();
  });

  // Debug region polygon data
  let debugPolygons = $derived.by(() => {
    if (!showRegionPolygon || !prefPolygons || !mapInfo) return [];
    
    const region = allRegions.find((r) => r.id === selectedRegion);
    if (!region?.prefectures) return [];
    
    const polygons = [];
    
    const projectRing = (ring) => {
      return ring.map((pt) => {
        const x = projectX(pt[0]);
        const y = projectY(pt[1]);
        return `${x},${y}`;
      }).join(" ");
    };
    
    for (const code of region.prefectures) {
      const geom = prefPolygons[code];
      if (!geom) continue;
      if (geom.type === "Polygon") {
        polygons.push({
          points: projectRing(geom.coordinates[0])
        });
      } else if (geom.type === "MultiPolygon") {
        geom.coordinates.forEach((poly) => {
          polygons.push({
            points: projectRing(poly[0])
          });
        });
      }
    }
    
    return polygons;
  });

  // Redraw map metadata on layout changes to sync panning bounds
  $effect(() => {
    if (layoutData) {
      mapInfo = { bounds, svgWidth, svgHeight };
      
      const pending = regionViewPending;
      if (pending) {
        regionViewPending = null;
        applyRegionInitialView(pending, mapInfo);
      }
    }
  });

  const handleReset = () => {
    zoom = 1;
    panX = 0;
    panY = 0;
  };

  let regionViewPending = null;

  const applyRegionInitialView = (regionId, info) => {
    const region = allRegions.find((r) => r.id === regionId);
    if (region?.initialView && info) {
      const { center, zoom: targetZoom } = region.initialView;
      const mx =
        ((center.lng - info.bounds.min_x) /
          (info.bounds.max_x - info.bounds.min_x)) *
        info.svgWidth;
      const my =
        info.svgHeight -
        ((center.lat - info.bounds.min_y) /
          (info.bounds.max_y - info.bounds.min_y)) *
          info.svgHeight;
      zoom = targetZoom;
      panX = info.svgWidth / 2 - mx * targetZoom;
      panY = info.svgHeight / 2 - my * targetZoom;
    } else {
      handleReset();
    }
  };

  const clampZoom = (newZoom) => {
    const pxPerDeg = computePixelsPerDegree(mapInfo, newZoom);
    if (pxPerDeg < 30 || pxPerDeg > 10000) return zoom;
    return newZoom;
  };

  const zoomToPoint = (point, factor) => {
    const x = (point.x - panX) / zoom;
    const y = (point.y - panY) / zoom;
    const newZoom = clampZoom(zoom * factor);
    panX = point.x - x * newZoom;
    panY = point.y - y * newZoom;
    zoom = newZoom;
  };

  const zoomIn = () => {
    if (!svgViewerEl) return;
    zoomToPoint(getSvgViewportCenter(), 1.3);
  };

  const zoomOut = () => {
    if (!svgViewerEl) return;
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
    if (e.button !== 0) return;
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
      const newZoom = clampZoom(initialPinchZoom * (newDist / initialPinchDistance));
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
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
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
      class="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"
      style="--zoom: {zoom};"
    >
      {#if layoutData}
        <svg
          width="{svgWidth}px"
          height="{currentSvgHeight}px"
          viewBox={viewBoxString}
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          class="pointer-events-auto"
        >
          <g
            data-map-layer
            transform="translate({panX} {panY}) scale({zoom})"
            fill="none"
            fill-rule="evenodd"
            stroke-linecap="square"
            stroke-linejoin="square"
          >
            <!-- Japan land outline -->
            {#if showBaseMapOutline && japanOutlinePathD && $transitionProgress < 0.95}
              <path
                class="japan-outline-path"
                fill="var(--color-map-land-fill)"
                stroke="var(--color-map-land-stroke)"
                stroke-width="1"
                vector-effect="non-scaling-stroke"
                fill-rule="evenodd"
                d={japanOutlinePathD}
                style="opacity: {Math.max(0, Math.min(1, (0.2 - $transitionProgress) / 0.2))}; transition: opacity 0.15s;"
              />
            {/if}

            <!-- Debug Region Polygon overlay -->
            {#if showRegionPolygon && debugPolygons.length > 0 && $transitionProgress < 0.95}
              {#each debugPolygons as poly}
                <polygon
                  class="debug-region-polygon"
                  points={poly.points}
                  fill="rgba(255,80,80,0.06)"
                  stroke="rgba(255,80,80,0.8)"
                  stroke-width="2"
                  stroke-dasharray="10 5"
                  vector-effect="non-scaling-stroke"
                  style="opacity: {Math.max(0, Math.min(1, (0.2 - $transitionProgress) / 0.2))};"
                />
              {/each}
            {/if}

            <!-- Train Lines -->
            {#each renderedLines as line (line.key)}
              {#if $transitionProgress > 0.05}
                <line
                  x1={paddingLeft}
                  y1={line.ySchematic}
                  x2={svgWidth - paddingRight}
                  y2={line.ySchematic}
                  stroke={line.color}
                  stroke-width={lineStrokeWidth}
                  vector-effect="non-scaling-stroke"
                  style="opacity: {transitionFinished ? 1 : 0}; transition: opacity 0.25s; pointer-events: none;"
                />
              {/if}
              {#each line.paths as path, pathIdx}
                <g class="segment">
                  <path
                    id={path.id}
                    d={path.d}
                    stroke={line.color}
                    stroke-width={lineStrokeWidth}
                    vector-effect="non-scaling-stroke"
                  />
                </g>
              {/each}
            {/each}

            <!-- Stations -->
            {#each renderedStations as station (station.id)}
              <circle
                id={station.id}
                class="station-dot"
                cx={station.cx}
                cy={station.cy}
                r={station.r}
                fill={station.color}
                stroke={station.color}
                stroke-width="0.2"
                vector-effect="non-scaling-stroke"
                pointer-events="all"
                data-station-name={station.name}
                data-line-name={station.lineName}
                data-company-name={station.companyName}
                style="display: {station.display};"
              />
            {/each}

            <!-- Station Names (Linear schematic only) -->
            {#if $transitionProgress > 0.05}
              {#each renderedStations as station (station.id)}
                {#if station.showLabel && station.display !== "none"}
                  <text
                    class="station-label select-none pointer-events-none fill-secondary font-medium transition-opacity duration-300"
                    x={station.cx}
                    y={station.cy + 15}
                    transform="rotate(45, {station.cx}, {station.cy + 15})"
                    style="opacity: {transitionFinished ? 1 : 0}; transition: opacity 0.25s; font-size: 8px; font-weight: 500;"
                    text-anchor="start"
                  >
                    {station.name}
                  </text>
                {/if}
              {/each}
            {/if}

            <!-- Company/Line name labels on the left of each row (Linear schematic only) -->
            {#if $transitionProgress > 0.05}
              {#each renderedLines as line (line.key)}
                <text
                  class="line-label select-none pointer-events-none fill-secondary font-bold transition-opacity duration-300"
                  x={15}
                  y={line.ySchematic - 2}
                  style="opacity: {transitionFinished ? 1 : 0}; transition: opacity 0.25s; font-size: 12px; font-weight: 700;"
                  text-anchor="start"
                >
                  {line.displayNameJa}
                </text>
                <text
                  class="line-label-sub select-none pointer-events-none fill-[var(--color-text-muted)] transition-opacity duration-300"
                  x={15}
                  y={line.ySchematic + 10}
                  style="opacity: {transitionFinished ? 1 : 0}; transition: opacity 0.25s; font-size: 9px;"
                  text-anchor="start"
                >
                  {line.displayNameEn}
                </text>
              {/each}
            {/if}
          </g>
        </svg>
      {/if}
    </div>

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
      bind:schematicMode
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
