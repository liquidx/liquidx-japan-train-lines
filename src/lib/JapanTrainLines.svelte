<script>
  import { onMount } from "svelte";
  import { loadTrainLines, drawTrainLine } from "$lib/japan-train-lines.js";
  import { Eye, EyeOff, Minus, Moon, Palette, Plus, RotateCcw, SlidersHorizontal, Sun } from "@lucide/svelte";

  export let railroadGeoJsonUrl = "/railroad.geojson";
  export let stationGeoJsonUrl = null;
  export let japanOutlineGeoJsonUrl = null;
  let viewerEl;
  let regions = [];
  let regionDataMap = {};
  let trainCompanyNames = [];
  let selectedRegion = "kanto";
  let selectedCompany = null;
  let selectedLine = null;
  let showLineColors = true;
  let showBaseMapOutline = true;
  let mapTheme = "dark";

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
    const radius = lineStrokeWidth * (1.5 + zoomStep * 0.5);
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

  const applyMapTransform = () => {
    const mapLayer = viewerEl?.querySelector("[data-map-layer]");
    if (!mapLayer) return;

    mapLayer.setAttribute(
      "transform",
      `translate(${panX} ${panY}) scale(${zoom})`,
    );

    const screenCtm = mapLayer.getScreenCTM();
    const screenScale = screenCtm ? Math.hypot(screenCtm.a, screenCtm.b) : zoom;
    const adjustedStationRadius = stationRadiusForZoom(zoom) / screenScale;
    for (const station of mapLayer.querySelectorAll(".station-dot")) {
      station.setAttribute("r", adjustedStationRadius);
    }
  };

  onMount(async () => {
    let data = await loadTrainLines({ railroadGeoJsonUrl, stationGeoJsonUrl, japanOutlineGeoJsonUrl });
    regions = data.regions;
    regionDataMap = data.regionData;
    trainCompanyNames = regionDataMap[selectedRegion] || [];
    registerKeyboardShortcuts();
  });

  // Reactive redraw whenever region, company, line, or render option changes
  $: if (viewerEl && regions.length > 0) {
    drawTrainLine(
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

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    if (e.target.closest(".hud-controls")) return;

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

<div id="app-container" class="theme-{mapTheme} flex flex-col h-screen w-screen bg-[var(--color-app-bg)] overflow-hidden transition-colors duration-200">
  <!-- Title / Header Overlay -->
  <header class="h-[60px] bg-[var(--color-header-bg)] backdrop-blur-md border-b border-[color:var(--color-border)] flex justify-between items-center px-6 z-10 transition-colors duration-200">
    <div class="flex items-center gap-2.5">
      <span class="text-[20px]">🚇</span>
      <h1 class="font-['Outfit'] text-[18px] font-semibold m-0 text-[var(--color-text-primary)]">Japan Train Line Maps</h1>
      <span class="text-[12px] text-[var(--color-text-muted)] ml-1.5 pl-3 border-l border-[color:var(--color-border)]">鉄道路線図</span>
    </div>

    <div class="flex items-center gap-4">
      {#if selectedCompany}
        <div class="flex items-center gap-2 bg-[var(--color-surface-soft)] px-3.5 py-1.5 rounded-full border border-[color:var(--color-border)] text-[13px]">
          <span class="font-medium text-[var(--color-accent-secondary)]">{selectedCompany}</span>
          {#if selectedLine}
            <span class="text-[var(--color-text-faint)]">→</span>
            <span class="text-[var(--color-text-secondary)]">{selectedLine}</span>
          {/if}
        </div>
      {:else}
        <div class="flex items-center gap-2 bg-[var(--color-surface-soft)] px-3.5 py-1.5 rounded-full border border-[color:var(--color-border)] text-[13px]">
          <span class="font-medium text-[var(--color-accent-primary)]">
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
    on:mousedown={handleMouseDown}
    on:wheel={handleWheel}
    class="map-viewport flex-1 relative overflow-hidden select-none touch-none border-b border-[color:var(--color-border)] transition-colors duration-200"
    style="cursor: {isDragging ? 'grabbing' : 'grab'};"
  >
    <div
      id="svg-content-wrapper"
      bind:this={viewerEl}
      class="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"
      style="--zoom: {zoom};"
    ></div>

    <!-- HUD Overlay Controls -->
    <div class="hud-controls absolute top-5 right-5 flex items-start gap-3 z-[5]">
      <div class="w-[232px] bg-[var(--color-surface)] backdrop-blur-md rounded-xl border border-[color:var(--color-border)] shadow-[var(--shadow-panel)] overflow-hidden transition-colors duration-200">
        <div class="h-10 flex items-center gap-2 px-3.5 border-b border-[color:var(--color-border)] bg-[var(--color-surface-soft)]">
          <SlidersHorizontal size={15} strokeWidth={2.3} class="text-[var(--color-accent-tertiary)]" />
          <h2 class="m-0 text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--color-text-secondary)]">Map Appearance</h2>
        </div>

        <div class="p-2">
          <div class="grid grid-cols-2 gap-1 mb-1 rounded-lg bg-[var(--color-surface-soft)] p-1 border border-[color:var(--color-border-soft)]">
            <button
              class="h-8 rounded-md border border-transparent flex items-center justify-center gap-1.5 text-[11px] font-semibold cursor-pointer transition-all duration-200 {mapTheme === 'dark' ? 'bg-[var(--color-accent-primary-soft)] border-[color:var(--color-accent-primary-border)] text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}"
              on:click={() => (mapTheme = "dark")}
              aria-pressed={mapTheme === "dark"}
            >
              <Moon size={14} strokeWidth={2.2} />
              Dark
            </button>
            <button
              class="h-8 rounded-md border border-transparent flex items-center justify-center gap-1.5 text-[11px] font-semibold cursor-pointer transition-all duration-200 {mapTheme === 'light' ? 'bg-[var(--color-accent-primary-soft)] border-[color:var(--color-accent-primary-border)] text-[var(--color-accent-primary)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}"
              on:click={() => (mapTheme = "light")}
              aria-pressed={mapTheme === "light"}
            >
              <Sun size={14} strokeWidth={2.2} />
              Light
            </button>
          </div>

          <button
            class="w-full min-h-11 rounded-lg border border-transparent bg-transparent px-2.5 py-2 flex items-center justify-between gap-3 text-left cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:border-[color:var(--color-border)]"
            on:click={() => (showLineColors = !showLineColors)}
            aria-pressed={showLineColors}
          >
            <span class="flex items-center gap-2.5 min-w-0">
              <Palette size={16} strokeWidth={2.2} class={showLineColors ? "text-[var(--color-accent-primary)]" : "text-[var(--color-text-muted)]"} />
              <span class="flex flex-col min-w-0 leading-tight">
                <span class="text-[12px] font-semibold text-[var(--color-text-secondary)]">Line colors</span>
                <span class="text-[10px] text-[var(--color-text-muted)] truncate">{showLineColors ? "Official colors where available" : "Single-color rendering"}</span>
              </span>
            </span>
            <span class="w-[34px] h-[18px] rounded-full relative shrink-0 transition-colors duration-200 {showLineColors ? 'bg-[var(--color-accent-primary)]' : 'bg-[var(--color-switch-off)]'}">
              <span class="w-3 h-3 rounded-full bg-[var(--color-switch-knob)] absolute top-[3px] left-[3px] transition-transform duration-200 {showLineColors ? 'translate-x-4' : 'translate-x-0'}"></span>
            </span>
          </button>

          <button
            class="w-full min-h-11 rounded-lg border border-transparent bg-transparent px-2.5 py-2 flex items-center justify-between gap-3 text-left cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:border-[color:var(--color-border)]"
            on:click={() => (showBaseMapOutline = !showBaseMapOutline)}
            aria-pressed={showBaseMapOutline}
          >
            <span class="flex items-center gap-2.5 min-w-0">
              {#if showBaseMapOutline}
                <Eye size={16} strokeWidth={2.2} class="text-[var(--color-accent-tertiary)]" />
              {:else}
                <EyeOff size={16} strokeWidth={2.2} class="text-[var(--color-text-muted)]" />
              {/if}
              <span class="flex flex-col min-w-0 leading-tight">
                <span class="text-[12px] font-semibold text-[var(--color-text-secondary)]">Base map outline</span>
                <span class="text-[10px] text-[var(--color-text-muted)] truncate">{showBaseMapOutline ? "Land outline visible" : "Land outline hidden"}</span>
              </span>
            </span>
            <span class="w-[34px] h-[18px] rounded-full relative shrink-0 transition-colors duration-200 {showBaseMapOutline ? 'bg-[var(--color-accent-tertiary)]' : 'bg-[var(--color-switch-off)]'}">
              <span class="w-3 h-3 rounded-full bg-[var(--color-switch-knob)] absolute top-[3px] left-[3px] transition-transform duration-200 {showBaseMapOutline ? 'translate-x-4' : 'translate-x-0'}"></span>
            </span>
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2 bg-[var(--color-surface)] backdrop-blur-md p-1.5 rounded-xl border border-[color:var(--color-border)] shadow-[var(--shadow-panel)]">
        <button on:click={zoomIn} title="Zoom In" aria-label="Zoom In" class="w-9 h-9 rounded-lg border-none bg-transparent text-[var(--color-text-muted)] flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent-secondary)] active:bg-[var(--color-accent-secondary-soft)] active:text-[var(--color-accent-secondary)]">
          <Plus size={18} strokeWidth={2.5} />
        </button>
        <button on:click={zoomOut} title="Zoom Out" aria-label="Zoom Out" class="w-9 h-9 rounded-lg border-none bg-transparent text-[var(--color-text-muted)] flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent-secondary)] active:bg-[var(--color-accent-secondary-soft)] active:text-[var(--color-accent-secondary)]">
          <Minus size={18} strokeWidth={2.5} />
        </button>
        <button on:click={handleReset} title="Reset View" aria-label="Reset View" class="w-9 h-9 rounded-lg border-none bg-transparent text-[var(--color-text-muted)] flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent-secondary)] active:bg-[var(--color-accent-secondary-soft)] active:text-[var(--color-accent-secondary)]">
          <RotateCcw size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>

    <!-- Keyboard Hint -->
    <div class="absolute bottom-5 left-5 text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface)] px-3 py-1.5 rounded border border-[color:var(--color-border-soft)] pointer-events-none">
      Press <kbd class="bg-[var(--color-surface-soft)] border border-[color:var(--color-border)] rounded px-1 py-[1px] font-inherit text-[var(--color-text-secondary)]">➔</kbd> to cycle lines
    </div>
  </div>

  <!-- Controls Panel -->
  <section id="controls-panel" class="h-[38vh] flex flex-col bg-[var(--color-panel-bg)] z-[5] transition-colors duration-200">
    <!-- Region Selector Tabs -->
    <div class="flex bg-[var(--color-panel-strong)] border-b border-[color:var(--color-border)] px-4 gap-1.5 h-12 items-center overflow-x-auto scrollbar-thin">
      {#each regions as r}
        <button
          class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-transparent border border-transparent text-[var(--color-text-muted)] cursor-pointer whitespace-nowrap transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] {selectedRegion === r.id ? 'bg-[var(--color-accent-primary-soft)] border-[color:var(--color-accent-primary-border)] text-[var(--color-accent-primary)]' : ''}"
          on:click={() => selectRegion(r.id)}
        >
          <span class="w-1.5 h-1.5 rounded-full transition-all duration-200 border bg-transparent {selectedRegion === r.id ? 'border-[color:var(--color-accent-primary)] bg-[var(--color-accent-primary)] shadow-[0_0_6px_var(--color-accent-primary)]' : 'border-[color:var(--color-accent-primary-border)]'}"></span>
          <div class="flex flex-col items-start leading-[1.1]">
            <span class="text-[11px] font-semibold">{r.nameJa}</span>
            <span class="text-[9px] opacity-60 mt-[1px]">{r.name}</span>
          </div>
        </button>
      {/each}
    </div>

    <div class="flex flex-1 overflow-hidden">
      <!-- Left Column: Operating Companies -->
      <div class="flex flex-col h-full w-[320px] border-r border-[color:var(--color-border)] bg-[var(--color-panel-muted)]">
        <div class="h-12 flex justify-between items-center px-5 border-b border-[color:var(--color-border-soft)] bg-[var(--color-surface-soft)]">
          <h2 class="font-['Outfit'] text-[14px] font-semibold m-0 text-[var(--color-text-secondary)] uppercase tracking-[0.5px]">Operating Companies</h2>
          <span class="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] px-2 py-0.5 rounded-full">{trainCompanyNames.length} total</span>
        </div>
        <div class="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <button
            class="w-full border text-[var(--color-text-muted)] cursor-pointer text-left transition-all duration-200 p-[10px_14px] rounded-lg mb-1.5 hover:text-[var(--color-text-secondary)] border-dashed border-[color:var(--color-accent-primary-border)] hover:bg-[var(--color-accent-primary-soft)] {selectedCompany === null && selectedLine === null ? 'bg-[var(--color-accent-primary-soft)] text-[var(--color-accent-primary)]' : 'bg-transparent'}"
            on:click={selectFullRegionMap}
          >
            <div class="flex items-center gap-3">
              <span class="text-[16px] opacity-80">🌐</span>
              <div class="flex flex-col">
                <span class="text-[13px] font-medium">
                  {regions.find((r) => r.id === selectedRegion)?.nameJa ||
                    "全国"} Map
                </span>
                <span class="text-[10px] mt-[1px] transition-colors {selectedCompany === null && selectedLine === null ? 'text-[var(--color-accent-primary)] opacity-70' : 'text-[var(--color-text-faint)]'}"
                  >Show all regional lines overlay</span
                >
              </div>
            </div>
          </button>

          {#each trainCompanyNames as company}
            <button
              class="w-full border text-[var(--color-text-muted)] cursor-pointer text-left transition-all duration-200 p-[10px_14px] rounded-lg mb-1.5 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] {selectedCompany === company.company ? 'bg-[var(--color-accent-secondary-soft)] border-[color:var(--color-accent-secondary-border)] text-[var(--color-accent-secondary)]' : 'border-transparent bg-transparent'}"
              on:click={() => selectCompany(company.company)}
            >
              <div class="flex items-center gap-3">
                <span class="text-[16px] opacity-80">🏢</span>
                <div class="flex flex-col">
                  <span class="text-[13px] font-medium">{company.company}</span>
                  <span class="text-[10px] mt-[1px] transition-colors {selectedCompany === company.company ? 'text-[var(--color-accent-secondary)] opacity-70' : 'text-[var(--color-text-faint)]'}"
                    >{company.lines.length} lines</span
                  >
                </div>
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Right Column: Train Lines Grid -->
      <div class="flex flex-col h-full flex-1 bg-[var(--color-surface-soft)]">
        <div class="h-12 flex justify-between items-center px-5 border-b border-[color:var(--color-border-soft)] bg-[var(--color-surface-soft)]">
          <h2 class="font-['Outfit'] text-[14px] font-semibold m-0 text-[var(--color-text-secondary)] uppercase tracking-[0.5px]">
            {#if selectedCompany}
              {selectedCompany} Lines
            {:else}
              Select Company
            {/if}
          </h2>
          {#if selectedCompany}
            <span class="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] px-2 py-0.5 rounded-full">
              {(
                trainCompanyNames.find((c) => c.company === selectedCompany)
                  ?.lines || []
              ).length} lines
            </span>
          {/if}
        </div>

        <div class="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {#if selectedCompany}
            <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 w-full">
              {#each trainCompanyNames.find((c) => c.company === selectedCompany)?.lines || [] as line}
                <button
                  class="group w-full border bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] cursor-pointer text-left transition-all duration-200 flex items-center gap-2.5 p-[12px_16px] rounded-lg border-[color:var(--color-border-soft)] hover:bg-[var(--color-surface-hover)] hover:border-[color:var(--color-border)] hover:text-[var(--color-text-primary)] {selectedLine === line ? 'bg-[var(--color-accent-secondary-soft)] border-[color:var(--color-accent-secondary-border)] text-[var(--color-accent-tertiary)] shadow-[0_0_10px_var(--color-accent-secondary-soft)]' : ''}"
                  on:click={() => selectLine(selectedCompany, line)}
                >
                  <span
                    class="w-2 h-2 rounded-full shrink-0 transition-all duration-200 group-hover:scale-125"
                    style="background-color: {selectedLine === line
                      ? 'var(--color-accent-tertiary)'
                      : 'var(--color-text-faint)'}"
                  ></span>
                  <span class="text-[13px] font-medium">{line}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="flex items-center justify-center h-full min-h-[200px] text-center text-[var(--color-text-muted)]">
              <div class="max-w-[380px]">
                <span class="text-[32px] block mb-3 opacity-50">🗺️</span>
                <h3 class="font-['Outfit'] text-[var(--color-text-muted)] text-[16px] font-semibold m-[0_0_6px_0]">No Company Selected</h3>
                <p class="text-[12px] leading-relaxed m-0">
                  Choose a railway operating company from the left panel to
                  browse and visualize individual train lines, or view the
                  complete metropolitan map.
                </p>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>
</div>
