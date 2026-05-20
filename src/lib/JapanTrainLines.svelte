<script>
  import { onMount } from "svelte";
  import { loadTrainLines, drawTrainLine } from "$lib/japan-train-lines.js";

  export let railroadGeoJsonUrl = "/railroad.geojson";
  let viewerEl;
  let regions = [];
  let regionDataMap = {};
  let trainCompanyNames = [];
  let selectedRegion = "tokyo";
  let selectedCompany = "東京地下鉄";
  let selectedLine = "2号線日比谷線";
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

  onMount(async () => {
    let data = await loadTrainLines({ railroadGeoJsonUrl });
    regions = data.regions;
    regionDataMap = data.regionData;
    trainCompanyNames = regionDataMap[selectedRegion] || [];
    registerKeyboardShortcuts();
  });

  // Reactive redraw whenever region, company, line, or color option changes
  $: if (viewerEl && regions.length > 0) {
    drawTrainLine(selectedRegion, selectedCompany, selectedLine, viewerEl, 640, { showLineColors });
  }

  const handleReset = () => {
    zoom = 1;
    panX = 0;
    panY = 0;
  };

  const zoomToPoint = (clientX, clientY, factor) => {
    const x = (clientX - panX) / zoom;
    const y = (clientY - panY) / zoom;
    let newZoom = zoom * factor;
    // Limit zoom scale range
    newZoom = Math.max(0.15, Math.min(20, newZoom));
    panX = clientX - x * newZoom;
    panY = clientY - y * newZoom;
    zoom = newZoom;
  };

  const zoomIn = () => {
    if (!viewerEl) return;
    const container = viewerEl.parentElement;
    const rect = container.getBoundingClientRect();
    zoomToPoint(rect.width / 2, rect.height / 2, 1.3);
  };

  const zoomOut = () => {
    if (!viewerEl) return;
    const container = viewerEl.parentElement;
    const rect = container.getBoundingClientRect();
    zoomToPoint(rect.width / 2, rect.height / 2, 1 / 1.3);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.15;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const factor = e.deltaY < 0 ? zoomFactor : 1 / zoomFactor;
    zoomToPoint(mouseX, mouseY, factor);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Only left click
    if (e.target.closest('.hud-controls')) return;

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initPanX = panX;
    initPanY = panY;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
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
      (company) => company.company === selectedCompany
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
      (company) => company.company === selectedCompany
    );
    if (companyIndex === -1 || companyIndex === trainCompanyNames.length - 1) {
      return trainCompanyNames[0]?.company || selectedCompany;
    } else {
      return trainCompanyNames[companyIndex + 1].company;
    }
  };
</script>

<div id="app-container">
  <!-- Title / Header Overlay -->
  <header class="app-header">
    <div class="logo">
      <span class="icon">🚇</span>
      <h1>Japan Train Line Maps</h1>
      <span class="subtitle">鉄道路線図</span>
    </div>
    
    <div class="header-right">
      <!-- Mapped Colors Toggle Switch -->
      <div class="color-toggle-container">
        <span class="toggle-label">{showLineColors ? "Colored Lines" : "Monomap"}</span>
        <button 
          class="toggle-switch" 
          class:checked={showLineColors} 
          on:click={() => showLineColors = !showLineColors}
          aria-label="Toggle official line colors"
        >
          <span class="toggle-handle"></span>
        </button>
      </div>

      {#if selectedCompany}
        <div class="status-badge">
          <span class="company-badge">{selectedCompany}</span>
          {#if selectedLine}
            <span class="arrow">→</span>
            <span class="line-badge">{selectedLine}</span>
          {/if}
        </div>
      {:else}
        <div class="status-badge">
          <span class="company-badge region">
            {regions.find(r => r.id === selectedRegion)?.name || "All Japan"} Network
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
    style="cursor: {isDragging ? 'grabbing' : 'grab'};"
  >
    <div 
      id="svg-content-wrapper" 
      bind:this={viewerEl}
      style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0;"
    ></div>

    <!-- HUD Overlay Controls -->
    <div class="hud-controls">
      <button on:click={zoomIn} title="Zoom In" aria-label="Zoom In">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      <button on:click={zoomOut} title="Zoom Out" aria-label="Zoom Out">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      <button on:click={handleReset} title="Reset View" aria-label="Reset View">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
      </button>
    </div>

    <!-- Keyboard Hint -->
    <div class="keyboard-hint">
      Press <kbd>➔</kbd> to cycle lines
    </div>
  </div>

  <!-- Controls Panel -->
  <section id="controls-panel">
    <!-- Region Selector Tabs -->
    <div class="region-selector-bar">
      {#each regions as r}
        <button 
          class="region-tab" 
          class:active={selectedRegion === r.id}
          on:click={() => selectRegion(r.id)}
        >
          <span class="region-dot"></span>
          <div class="region-labels">
            <span class="region-name-ja">{r.nameJa}</span>
            <span class="region-name-en">{r.name}</span>
          </div>
        </button>
      {/each}
    </div>

    <div class="panel-body">
      <!-- Left Column: Operating Companies -->
      <div class="nav-column company-column">
        <div class="column-header">
          <h2>Operating Companies</h2>
          <span class="count-indicator">{trainCompanyNames.length} total</span>
        </div>
        <div class="scroll-area">
          <button 
            class="company-item region-quick-select" 
            class:active={selectedCompany === null && selectedLine === null}
            on:click={selectFullRegionMap}
          >
            <div class="item-content">
              <span class="badge-icon">🌐</span>
              <div class="text-group">
                <span class="primary-text">
                  {regions.find(r => r.id === selectedRegion)?.nameJa || "全国"} Map
                </span>
                <span class="secondary-text">Show all regional lines overlay</span>
              </div>
            </div>
          </button>

          {#each trainCompanyNames as company}
            <button 
              class="company-item" 
              class:active={selectedCompany === company.company}
              on:click={() => selectCompany(company.company)}
            >
              <div class="item-content">
                <span class="badge-icon">🏢</span>
                <div class="text-group">
                  <span class="primary-text">{company.company}</span>
                  <span class="secondary-text">{company.lines.length} lines</span>
                </div>
              </div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Right Column: Train Lines Grid -->
      <div class="nav-column line-column">
        <div class="column-header">
          <h2>
            {#if selectedCompany}
              {selectedCompany} Lines
            {:else}
              Select Company
            {/if}
          </h2>
          {#if selectedCompany}
            <span class="count-indicator">
              {(trainCompanyNames.find(c => c.company === selectedCompany)?.lines || []).length} lines
            </span>
          {/if}
        </div>
        
        <div class="scroll-area grid-view">
          {#if selectedCompany}
            <div class="lines-grid">
              {#each (trainCompanyNames.find(c => c.company === selectedCompany)?.lines || []) as line}
                <button 
                  class="line-item"
                  class:active={selectedLine === line}
                  on:click={() => selectLine(selectedCompany, line)}
                >
                  <span class="line-dot" style="background-color: {selectedLine === line ? '#06b6d4' : '#475569'}"></span>
                  <span class="line-name">{line}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="empty-state">
              <div class="empty-state">
                <div class="empty-content">
                  <span class="empty-icon">🗺️</span>
                  <h3>No Company Selected</h3>
                  <p>Choose a railway operating company from the left panel to browse and visualize individual train lines, or view the complete metropolitan map.</p>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>
</div>

<style>
  #app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background-color: #090d16;
    overflow: hidden;
  }

  /* Header Styling */
  .app-header {
    height: 60px;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
    z-index: 10;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo .icon {
    font-size: 20px;
  }

  .logo h1 {
    font-family: 'Outfit', sans-serif;
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    color: #ffffff;
    letter-spacing: -0.5px;
  }

  .logo .subtitle {
    font-size: 12px;
    color: #64748b;
    margin-left: 6px;
    padding-left: 12px;
    border-left: 1px solid rgba(255, 255, 255, 0.15);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .color-toggle-container {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.03);
    padding: 6px 14px;
    border-radius: 99px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .toggle-label {
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .toggle-switch {
    width: 34px;
    height: 18px;
    border-radius: 99px;
    background: #334155;
    border: none;
    position: relative;
    cursor: pointer;
    transition: background-color 0.2s ease;
    padding: 0;
  }

  .toggle-switch.checked {
    background: #a855f7;
  }

  .toggle-handle {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #ffffff;
    position: absolute;
    top: 3px;
    left: 3px;
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .toggle-switch.checked .toggle-handle {
    transform: translateX(16px);
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255, 255, 255, 0.04);
    padding: 6px 14px;
    border-radius: 99px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 13px;
  }

  .company-badge {
    font-weight: 500;
    color: #38bdf8;
  }
  .company-badge.region {
    color: #a855f7;
  }

  .arrow {
    color: #475569;
  }

  .line-badge {
    color: #e2e8f0;
  }

  /* SVG Viewer */
  #svg-viewer {
    flex: 1 1 0%;
    position: relative;
    background-color: #0b0f19;
    overflow: hidden;
    user-select: none;
    touch-action: none;
    /* Grid blueprint style background */
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 30px 30px;
    background-position: center center;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  #svg-content-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    will-change: transform;
    pointer-events: none; /* Let events fall through to #svg-viewer */
  }

  /* Dynamic event styling inside SVG */
  :global(#svg-content-wrapper svg) {
    pointer-events: auto; /* Re-enable pointer events for the SVG paths */
    max-width: 90%;
    max-height: 90%;
  }

  :global(#svg-content-wrapper g.segment path),
  :global(#svg-content-wrapper path) {
    transition: stroke-width 0.15s ease, stroke 0.15s ease, filter 0.15s ease;
    cursor: pointer;
    vector-effect: non-scaling-stroke;
  }

  :global(#svg-content-wrapper g.segment path:hover) {
    filter: drop-shadow(0 0 4px rgba(255, 0, 0, 0.6));
  }

  /* HUD Controls */
  .hud-controls {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(12px);
    padding: 6px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    z-index: 5;
  }

  .hud-controls button {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .hud-controls button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #38bdf8;
  }

  .hud-controls button:active {
    background: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  /* Keyboard Hint */
  .keyboard-hint {
    position: absolute;
    bottom: 20px;
    left: 20px;
    font-size: 11px;
    color: #475569;
    background: rgba(15, 23, 42, 0.5);
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    pointer-events: none;
  }

  .keyboard-hint kbd {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 3px;
    padding: 1px 4px;
    font-family: inherit;
    color: #94a3b8;
  }

  /* Controls Panel (Bottom split) */
  #controls-panel {
    height: 38vh;
    display: flex;
    flex-direction: column;
    background: #0f172a;
    z-index: 5;
  }

  /* Region Selector Bar */
  .region-selector-bar {
    display: flex;
    background: rgba(15, 23, 42, 0.9);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0 16px;
    gap: 6px;
    height: 48px;
    align-items: center;
    overflow-x: auto;
  }

  .region-selector-bar::-webkit-scrollbar {
    height: 3px;
  }

  .region-selector-bar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 99px;
  }

  .region-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid transparent;
    color: #64748b;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s ease;
  }

  .region-tab:hover {
    background: rgba(255, 255, 255, 0.03);
    color: #94a3b8;
  }

  .region-tab.active {
    background: rgba(168, 85, 247, 0.08);
    border-color: rgba(168, 85, 247, 0.2);
    color: #c084fc;
  }

  .region-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    transition: background-color 0.2s ease, border-color 0.2s ease;
    border: 1px solid rgba(168, 85, 247, 0.4);
    background-color: transparent;
  }

  .region-tab.active .region-dot {
    border-color: #c084fc;
    background-color: #c084fc;
    box-shadow: 0 0 6px #c084fc;
  }

  .region-labels {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.1;
  }

  .region-name-ja {
    font-size: 11px;
    font-weight: 600;
  }

  .region-name-en {
    font-size: 9px;
    opacity: 0.6;
    margin-top: 1px;
  }

  .panel-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* Navigation Columns */
  .nav-column {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .company-column {
    width: 320px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(15, 23, 42, 0.4);
  }

  .line-column {
    flex: 1;
    background: rgba(15, 23, 42, 0.2);
  }

  .column-header {
    height: 48px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(15, 23, 42, 0.5);
  }

  .column-header h2 {
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    font-weight: 600;
    margin: 0;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .count-indicator {
    font-size: 11px;
    color: #475569;
    background: rgba(255, 255, 255, 0.04);
    padding: 2px 8px;
    border-radius: 99px;
  }

  /* Scrollable Areas */
  .scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  /* Custom Scrollbar Styling */
  .scroll-area::-webkit-scrollbar {
    width: 6px;
  }

  .scroll-area::-webkit-scrollbar-track {
    background: transparent;
  }

  .scroll-area::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 99px;
  }

  .scroll-area::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Nav Buttons (General) */
  .company-item, .line-item {
    width: 100%;
    border: 1px solid transparent;
    background: transparent;
    color: #94a3b8;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
  }

  /* Company Items */
  .company-item {
    padding: 10px 14px;
    border-radius: 8px;
    margin-bottom: 6px;
  }

  .company-item:hover {
    background: rgba(255, 255, 255, 0.03);
    color: #e2e8f0;
  }

  .company-item.active {
    background: rgba(56, 189, 248, 0.08);
    border-color: rgba(56, 189, 248, 0.2);
    color: #38bdf8;
  }

  .region-quick-select {
    border: 1px dashed rgba(168, 85, 247, 0.2);
    background: rgba(168, 85, 247, 0.02);
  }

  .region-quick-select:hover {
    border-color: rgba(168, 85, 247, 0.4);
    background: rgba(168, 85, 247, 0.04);
  }

  .region-quick-select.active {
    background: rgba(168, 85, 247, 0.08);
    border-color: rgba(168, 85, 247, 0.3);
    color: #c084fc;
  }

  .item-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .badge-icon {
    font-size: 16px;
    opacity: 0.8;
  }

  .text-group {
    display: flex;
    flex-direction: column;
  }

  .primary-text {
    font-size: 13px;
    font-weight: 500;
  }

  .secondary-text {
    font-size: 10px;
    color: #475569;
    margin-top: 1px;
  }

  .company-item.active .secondary-text {
    color: rgba(56, 189, 248, 0.6);
  }

  .region-quick-select.active .secondary-text {
    color: rgba(168, 85, 247, 0.6);
  }

  /* Grid View for Lines */
  .grid-view {
    display: flex;
    flex-direction: column;
  }

  .lines-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
    width: 100%;
  }

  /* Line Items */
  .line-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
  }

  .line-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.08);
    color: #f1f5f9;
  }

  .line-item.active {
    background: rgba(6, 182, 212, 0.08);
    border-color: rgba(6, 182, 212, 0.2);
    color: #06b6d4;
    box-shadow: 0 0 10px rgba(6, 182, 212, 0.05);
  }

  .line-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: transform 0.2s ease, background-color 0.2s ease;
  }

  .line-item:hover .line-dot {
    transform: scale(1.3);
    background-color: #38bdf8 !important;
  }

  .line-name {
    font-size: 13px;
    font-weight: 500;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    text-align: center;
    color: #475569;
  }

  .empty-content {
    max-width: 380px;
  }

  .empty-icon {
    font-size: 32px;
    display: block;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .empty-content h3 {
    font-family: 'Outfit', sans-serif;
    color: #64748b;
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 6px 0;
  }

  .empty-content p {
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
  }
</style>
