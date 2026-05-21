<script>
  import { onMount } from "svelte";
  import { loadTrainLines, drawTrainLine } from "$lib/japan-train-lines.js";
  import { Plus, Minus, RotateCcw } from "@lucide/svelte";

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

  // Reactive redraw whenever region, company, line, or color option changes
  $: if (viewerEl && regions.length > 0) {
    drawTrainLine(
      selectedRegion,
      selectedCompany,
      selectedLine,
      viewerEl,
      640,
      { showLineColors },
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

<div id="app-container" class="flex flex-col h-screen w-screen bg-[#090d16] overflow-hidden">
  <!-- Title / Header Overlay -->
  <header class="h-[60px] bg-slate-900/80 backdrop-blur-md border-b border-white/8 flex justify-between items-center px-6 z-10">
    <div class="flex items-center gap-2.5">
      <span class="text-[20px]">🚇</span>
      <h1 class="font-['Outfit'] text-[18px] font-semibold m-0 text-white tracking-[-0.5px]">Japan Train Line Maps</h1>
      <span class="text-[12px] text-slate-500 ml-1.5 pl-3 border-l border-white/15">鉄道路線図</span>
    </div>

    <div class="flex items-center gap-4">
      <!-- Mapped Colors Toggle Switch -->
      <div class="flex items-center gap-2 bg-white/3 px-3.5 py-1.5 rounded-full border border-white/6">
        <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.5px]"
          >{showLineColors ? "Colored Lines" : "Monomap"}</span
        >
        <button
          class="w-[34px] h-[18px] rounded-full border-none relative cursor-pointer transition-colors duration-200 p-0 {showLineColors ? 'bg-[#a855f7]' : 'bg-slate-700'}"
          on:click={() => (showLineColors = !showLineColors)}
          aria-label="Toggle official line colors"
        >
          <span class="w-3 h-3 rounded-full bg-white absolute top-[3px] left-[3px] transition-transform duration-200 cubic-bezier(0.4, 0, 0.2, 1) {showLineColors ? 'translate-x-4' : 'translate-x-0'}"></span>
        </button>
      </div>

      {#if selectedCompany}
        <div class="flex items-center gap-2 bg-white/4 px-3.5 py-1.5 rounded-full border border-white/8 text-[13px]">
          <span class="font-medium text-sky-400">{selectedCompany}</span>
          {#if selectedLine}
            <span class="text-slate-600">→</span>
            <span class="text-slate-200">{selectedLine}</span>
          {/if}
        </div>
      {:else}
        <div class="flex items-center gap-2 bg-white/4 px-3.5 py-1.5 rounded-full border border-white/8 text-[13px]">
          <span class="font-medium text-purple-400">
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
    class="flex-1 relative bg-[#0b0f19] overflow-hidden select-none touch-none bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] bg-center border-b border-white/8"
    style="cursor: {isDragging ? 'grabbing' : 'grab'};"
  >
    <div
      id="svg-content-wrapper"
      bind:this={viewerEl}
      class="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"
      style="--zoom: {zoom};"
    ></div>

    <!-- HUD Overlay Controls -->
    <div class="absolute top-5 right-5 flex flex-col gap-2 bg-slate-900/70 backdrop-blur-md p-1.5 rounded-xl border border-white/8 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] z-[5]">
      <button on:click={zoomIn} title="Zoom In" aria-label="Zoom In" class="w-9 h-9 rounded-lg border-none bg-transparent text-slate-400 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-white/8 hover:text-sky-400 active:bg-sky-500/15 active:text-sky-500">
        <Plus size={18} strokeWidth={2.5} />
      </button>
      <button on:click={zoomOut} title="Zoom Out" aria-label="Zoom Out" class="w-9 h-9 rounded-lg border-none bg-transparent text-slate-400 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-white/8 hover:text-sky-400 active:bg-sky-500/15 active:text-sky-500">
        <Minus size={18} strokeWidth={2.5} />
      </button>
      <button on:click={handleReset} title="Reset View" aria-label="Reset View" class="w-9 h-9 rounded-lg border-none bg-transparent text-slate-400 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-white/8 hover:text-sky-400 active:bg-sky-500/15 active:text-sky-500">
        <RotateCcw size={16} strokeWidth={2.5} />
      </button>
    </div>

    <!-- Keyboard Hint -->
    <div class="absolute bottom-5 left-5 text-[11px] text-slate-600 bg-slate-900/50 px-3 py-1.5 rounded border border-white/4 pointer-events-none">
      Press <kbd class="bg-white/8 border border-white/15 rounded px-1 py-[1px] font-inherit text-slate-400">➔</kbd> to cycle lines
    </div>
  </div>

  <!-- Controls Panel -->
  <section id="controls-panel" class="h-[38vh] flex flex-col bg-[#0f172a] z-[5]">
    <!-- Region Selector Tabs -->
    <div class="flex bg-slate-900/90 border-b border-white/8 px-4 gap-1.5 h-12 items-center overflow-x-auto scrollbar-thin">
      {#each regions as r}
        <button
          class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-transparent border border-transparent text-slate-500 cursor-pointer whitespace-nowrap transition-all duration-200 hover:bg-white/3 hover:text-slate-400 {selectedRegion === r.id ? 'bg-purple-500/8 border-purple-500/20 text-purple-400' : ''}"
          on:click={() => selectRegion(r.id)}
        >
          <span class="w-1.5 h-1.5 rounded-full transition-all duration-200 border bg-transparent {selectedRegion === r.id ? 'border-purple-400 bg-purple-400 shadow-[0_0_6px_#c084fc]' : 'border-purple-500/40'}"></span>
          <div class="flex flex-col items-start leading-[1.1]">
            <span class="text-[11px] font-semibold">{r.nameJa}</span>
            <span class="text-[9px] opacity-60 mt-[1px]">{r.name}</span>
          </div>
        </button>
      {/each}
    </div>

    <div class="flex flex-1 overflow-hidden">
      <!-- Left Column: Operating Companies -->
      <div class="flex flex-col h-full w-[320px] border-r border-white/8 bg-slate-900/40">
        <div class="h-12 flex justify-between items-center px-5 border-b border-white/6 bg-slate-900/50">
          <h2 class="font-['Outfit'] text-[14px] font-semibold m-0 text-slate-400 uppercase tracking-[0.5px]">Operating Companies</h2>
          <span class="text-[11px] text-slate-600 bg-white/4 px-2 py-0.5 rounded-full">{trainCompanyNames.length} total</span>
        </div>
        <div class="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <button
            class="w-full border text-slate-400 cursor-pointer text-left transition-all duration-200 p-[10px_14px] rounded-lg mb-1.5 hover:text-slate-200 border-dashed border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/4 {selectedCompany === null && selectedLine === null ? 'bg-purple-500/8 border-purple-500/30 text-purple-400' : 'bg-purple-500/2'}"
            on:click={selectFullRegionMap}
          >
            <div class="flex items-center gap-3">
              <span class="text-[16px] opacity-80">🌐</span>
              <div class="flex flex-col">
                <span class="text-[13px] font-medium">
                  {regions.find((r) => r.id === selectedRegion)?.nameJa ||
                    "全国"} Map
                </span>
                <span class="text-[10px] mt-[1px] transition-colors {selectedCompany === null && selectedLine === null ? 'text-purple-400/60' : 'text-slate-600'}"
                  >Show all regional lines overlay</span
                >
              </div>
            </div>
          </button>

          {#each trainCompanyNames as company}
            <button
              class="w-full border text-slate-400 cursor-pointer text-left transition-all duration-200 p-[10px_14px] rounded-lg mb-1.5 hover:bg-white/3 hover:text-slate-200 {selectedCompany === company.company ? 'bg-sky-500/8 border-sky-500/20 text-sky-400' : 'border-transparent bg-transparent'}"
              on:click={() => selectCompany(company.company)}
            >
              <div class="flex items-center gap-3">
                <span class="text-[16px] opacity-80">🏢</span>
                <div class="flex flex-col">
                  <span class="text-[13px] font-medium">{company.company}</span>
                  <span class="text-[10px] mt-[1px] transition-colors {selectedCompany === company.company ? 'text-sky-400/60' : 'text-slate-600'}"
                    >{company.lines.length} lines</span
                  >
                </div>
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Right Column: Train Lines Grid -->
      <div class="flex flex-col h-full flex-1 bg-slate-900/20">
        <div class="h-12 flex justify-between items-center px-5 border-b border-white/6 bg-slate-900/50">
          <h2 class="font-['Outfit'] text-[14px] font-semibold m-0 text-slate-400 uppercase tracking-[0.5px]">
            {#if selectedCompany}
              {selectedCompany} Lines
            {:else}
              Select Company
            {/if}
          </h2>
          {#if selectedCompany}
            <span class="text-[11px] text-slate-600 bg-white/4 px-2 py-0.5 rounded-full">
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
                  class="group w-full border bg-white/2 text-slate-400 cursor-pointer text-left transition-all duration-200 flex items-center gap-2.5 p-[12px_16px] rounded-lg border-white/4 hover:bg-white/5 hover:border-white/8 hover:text-slate-100 {selectedLine === line ? 'bg-cyan-500/8 border-cyan-500/20 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.05)]' : ''}"
                  on:click={() => selectLine(selectedCompany, line)}
                >
                  <span
                    class="w-2 h-2 rounded-full shrink-0 transition-all duration-200 group-hover:scale-125 group-hover:!bg-sky-400"
                    style="background-color: {selectedLine === line
                      ? '#06b6d4'
                      : '#475569'}"
                  ></span>
                  <span class="text-[13px] font-medium">{line}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="flex items-center justify-center h-full min-h-[200px] text-center text-slate-600">
              <div class="max-w-[380px]">
                <span class="text-[32px] block mb-3 opacity-50">🗺️</span>
                <h3 class="font-['Outfit'] text-slate-500 text-[16px] font-semibold m-[0_0_6px_0]">No Company Selected</h3>
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
