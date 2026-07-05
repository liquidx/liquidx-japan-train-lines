<svelte:options runes={true} />

<script>
  import {
    ChevronDown,
    ChevronUp,
    Circle,
    Eye,
    EyeOff,
    Map,
    Minus,
    Moon,
    Palette,
    Plus,
    RotateCcw,
    Scan,
    SlidersHorizontal,
    Sun,
    List,
  } from "@lucide/svelte";
  import { companyNameMapping, lineNameMapping } from "$lib/line-name-mapping";
  import LineCell from "$lib/LineCell.svelte";
  import ToggleOption from "$lib/ToggleOption.svelte";

  let {
    // Line selection
    regions = [],
    trainCompanyNames = [],
    selectedRegion = null,
    selectedCompany = null,
    selectedLine = null,
    onselectregion,
    onselectcompany,
    onselectline,
    onselectfullregionmap,
    // Map appearance (used in mobile panel, desktop delegates to MapAppearanceControls)
    mapTheme = $bindable("dark"),
    showLineColors = $bindable(true),
    showBaseMapOutline = $bindable(true),
    forceShowStations = $bindable(false),
    stationSizeMultiplier = $bindable(1),
    showRegionPolygon = $bindable(false),
    schematicMode = $bindable(false),
    onzoomIn,
    onzoomOut,
    onreset,
    // Optional snippets: `footer` renders below the header bar (visible even
    // when collapsed); `appearanceExtra` replaces the appearance tab content.
    footer = null,
    appearanceExtra = null,
  } = $props();

  let collapsed = $state(true);
  let activePanel = $state("lines"); // "lines" | "appearance"
  let expandedCompany = $state(null);

  $effect(() => {
    if (selectedCompany) {
      expandedCompany = selectedCompany;
    } else {
      expandedCompany = null;
    }
  });

  const handleCompanyClick = (companyName) => {
    if (selectedCompany === companyName) {
      expandedCompany = expandedCompany === companyName ? null : companyName;
    } else {
      onselectcompany?.(companyName);
    }
  };

  const linePrimaryName = (line) => {
    if (lineNameMapping[line] && lineNameMapping[line].ja) {
      return lineNameMapping[line].ja;
    }
    return line;
  };

  const companyPrimaryName = (company) => {
    if (companyNameMapping[company] && companyNameMapping[company].ja) {
      return companyNameMapping[company].ja;
    }
    return company;
  };

  const companyEnglishName = (company) => {
    return companyNameMapping[company]?.en ?? null;
  };
</script>

<!-- Floating panel — bottom on mobile, top-left on desktop -->
<div
  class="hud-controls absolute z-10
    bottom-3 left-3 right-3
    md:bottom-auto md:top-5 md:left-5 md:right-auto md:w-72"
  ontouchstart={(e) => e.stopPropagation()}
  ontouchmove={(e) => e.stopPropagation()}
  ontouchend={(e) => e.stopPropagation()}
  onwheel={(e) => e.stopPropagation()}
>
  <div
    class="bg-panel-background backdrop-blur-md rounded-xl border border-border shadow-[var(--shadow-panel)] overflow-hidden transition-colors duration-200 flex flex-col
      {collapsed ? '' : 'max-h-[70vh] md:max-h-[80vh]'}"
  >
    <!-- Header bar (always visible) -->
    <div
      class="w-full h-10 flex items-center bg-[var(--color-surface-soft)] shrink-0"
    >
      <!-- Collapse / expand toggle -->
      <button
        class="flex items-center gap-2 px-3 flex-1 h-full min-w-0 cursor-pointer transition-colors duration-200 hover:bg-[var(--color-surface-hover)]"
        onclick={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
      >
        <Map
          size={15}
          strokeWidth={2.3}
          class="text-[var(--color-accent-primary)] shrink-0"
        />
        <span
          class="flex-1 min-w-0 text-left flex items-center gap-1.5 overflow-hidden"
        >
          {#if selectedCompany}
            <span
              class="text-[11px] font-medium text-accent-secondary truncate"
              >{companyPrimaryName(selectedCompany)}</span
            >
            {#if selectedLine}
              <span class="text-muted text-[10px] shrink-0">→</span>
              <span class="text-[11px] text-secondary truncate"
                >{linePrimaryName(selectedLine)}</span
              >
            {/if}
          {:else}
            <span
              class="text-[11px] font-medium uppercase tracking-[0.6px] text-[var(--color-text-secondary)]"
            >
              {regions.find((r) => r.id === selectedRegion)?.nameJa ||
                "路線を選択"}
            </span>
          {/if}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={2.5}
          class="text-muted transition-transform duration-200 shrink-0 {collapsed
            ? ''
            : 'rotate-180'}"
        />
      </button>

      <!-- Zoom buttons — always visible in header -->
      <div
        class="flex items-center gap-0.5 pr-1.5 pl-1 border-l border-border h-7"
      >
        <button
          onclick={(e) => { e.stopPropagation(); schematicMode = !schematicMode; }}
          title="Schematic View"
          aria-label="Schematic View"
          aria-pressed={schematicMode}
          class="w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-all duration-200
            {schematicMode
              ? 'bg-[var(--color-accent-primary-soft)] text-accent-primary'
              : 'text-muted hover:bg-[var(--color-surface-hover)] hover:text-accent-secondary'}"
        >
          <List size={14} strokeWidth={2.5} />
        </button>
        <button
          onclick={(e) => { e.stopPropagation(); onzoomIn?.(); }}
          title="Zoom In"
          aria-label="Zoom In"
          class="w-7 h-7 rounded-md border-none bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-accent-secondary active:bg-[var(--color-accent-secondary-soft)] active:text-accent-secondary"
        >
          <Plus size={14} strokeWidth={2.5} />
        </button>
        <button
          onclick={(e) => { e.stopPropagation(); onzoomOut?.(); }}
          title="Zoom Out"
          aria-label="Zoom Out"
          class="w-7 h-7 rounded-md border-none bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-accent-secondary active:bg-[var(--color-accent-secondary-soft)] active:text-accent-secondary"
        >
          <Minus size={14} strokeWidth={2.5} />
        </button>
        <button
          onclick={(e) => { e.stopPropagation(); onreset?.(); }}
          title="Reset View"
          aria-label="Reset View"
          class="w-7 h-7 rounded-md border-none bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-accent-secondary active:bg-[var(--color-accent-secondary-soft)] active:text-accent-secondary"
        >
          <RotateCcw size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>

    {@render footer?.()}

    {#if !collapsed}
      <!-- Tab switcher -->
      <div
        class="flex shrink-0 border-b border-border bg-[var(--color-panel-muted)]"
      >
        <button
          class="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-medium cursor-pointer transition-colors duration-200
            {activePanel === 'lines'
            ? 'text-accent-primary border-b-2 border-[var(--color-accent-primary)]'
            : 'text-muted hover:text-secondary'}"
          onclick={() => (activePanel = "lines")}
        >
          <Map size={12} strokeWidth={2.3} />
          Lines
        </button>
        <button
          class="flex-1 h-8 flex items-center justify-center gap-1.5 text-[11px] font-medium cursor-pointer transition-colors duration-200
            {activePanel === 'appearance'
            ? 'text-accent-primary border-b-2 border-[var(--color-accent-primary)]'
            : 'text-muted hover:text-secondary'}"
          onclick={() => (activePanel = "appearance")}
        >
          <SlidersHorizontal size={12} strokeWidth={2.3} />
          Appearance
        </button>
      </div>

      <!-- Lines panel -->
      <div
        class="{activePanel === 'lines' ? 'flex' : 'hidden'} flex-col flex-1 overflow-hidden"
      >
        <!-- Scrollable accordion (regions + companies) -->
        <div class="flex-1 overflow-y-auto scrollbar-thin">
          <!-- Region grid -->
          <div class="grid grid-cols-2 gap-1 p-2 border-b border-border">
            {#each regions as r (r.id)}
              <button
                class="flex flex-col items-start px-2.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 text-left
                  {selectedRegion === r.id
                  ? 'bg-[var(--color-accent-primary-soft)] text-accent-primary'
                  : 'text-muted hover:bg-[var(--color-surface-hover)] hover:text-secondary'}"
                onclick={() => onselectregion?.(r.id)}
              >
                <span class="text-xs font-medium leading-tight {selectedRegion === r.id ? 'text-accent-primary' : ''}">{r.nameJa}</span>
                <span class="text-xxs text-muted leading-tight">{r.name}</span>
              </button>
            {/each}
          </div>
          <button
            class="w-full text-left px-4 py-2.5 border-b border-border transition-colors duration-150
              {selectedCompany === null && selectedLine === null
              ? 'bg-[var(--color-accent-primary-soft)] text-accent-primary'
              : 'text-secondary hover:bg-[var(--color-surface-hover)]'}"
            onclick={() => onselectfullregionmap?.()}
          >
            <span class="text-sm font-medium">
              {regions.find((r) => r.id === selectedRegion)?.nameJa || "全国"}
            </span>
            <span class="text-xxs text-muted ml-2">All regional lines</span>
          </button>

          {#each trainCompanyNames as company (company.company)}
            <div class="border-b border-border">
              <button
                class="w-full text-left px-4 py-2.5 flex items-center justify-between transition-colors duration-150
                  {selectedCompany === company.company
                  ? 'bg-[var(--color-accent-primary-soft)] text-accent-primary'
                  : 'text-secondary hover:bg-[var(--color-surface-hover)]'}"
                onclick={() => handleCompanyClick(company.company)}
              >
                <span class="flex flex-col min-w-0 truncate">
                  <span class="text-sm font-medium truncate"
                    >{companyPrimaryName(company.company)}</span
                  >
                  {#if companyEnglishName(company.company)}
                    <span class="text-xxs text-muted truncate"
                      >{companyEnglishName(company.company)}</span
                    >
                  {/if}
                </span>
                <span class="flex items-center gap-1.5 shrink-0 ml-2">
                  <span class="text-xxs text-muted">{company.lines.length}</span
                  >
                  {#if expandedCompany === company.company}
                    <ChevronUp size={14} class="text-muted" />
                  {:else}
                    <ChevronDown size={14} class="text-muted" />
                  {/if}
                </span>
              </button>

              {#if expandedCompany === company.company}
                <div
                  class="bg-[var(--color-surface-soft)] px-3 py-2 grid grid-cols-2 gap-1.5"
                >
                  {#each company.lines as line (line)}
                    <LineCell
                      {line}
                      company={selectedCompany}
                      selected={selectedLine === line}
                      onclick={() =>
                        onselectline?.({ company: selectedCompany, line })}
                    />
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Appearance panel -->
      <div
        class="{activePanel === 'appearance' ? 'flex' : 'hidden'} flex-col flex-1 overflow-y-auto scrollbar-thin"
      >
        {#if appearanceExtra}
          {@render appearanceExtra()}
        {:else}
        <div class="p-2">
          <!-- Theme toggle -->
          <div
            class="grid grid-cols-2 gap-1 mb-1 rounded-lg bg-[var(--color-surface-soft)] p-1 border border-border"
          >
            <button
              class="h-8 rounded-md border border-transparent flex items-center justify-center gap-1.5 text-[11px] font-medium cursor-pointer transition-all duration-200 {mapTheme ===
              'dark'
                ? 'bg-[var(--color-accent-primary-soft)] border-border text-accent-primary'
                : 'text-muted hover:bg-[var(--color-surface-hover)]'}"
              onclick={() => (mapTheme = "dark")}
              aria-pressed={mapTheme === "dark"}
            >
              <Moon size={14} strokeWidth={2.2} />
              Dark
            </button>
            <button
              class="h-8 rounded-md border border-transparent flex items-center justify-center gap-1.5 text-[11px] font-medium cursor-pointer transition-all duration-200 {mapTheme ===
              'light'
                ? 'bg-[var(--color-accent-primary-soft)] border-border text-accent-primary'
                : 'text-muted hover:bg-[var(--color-surface-hover)]'}"
              onclick={() => (mapTheme = "light")}
              aria-pressed={mapTheme === "light"}
            >
              <Sun size={14} strokeWidth={2.2} />
              Light
            </button>
          </div>

          <ToggleOption
            bind:checked={showLineColors}
            label="Line colors"
            description=""
            color="var(--color-accent-primary)"
          >
            <Palette
              size={16}
              strokeWidth={2.2}
              class={showLineColors ? "text-primary" : "text-muted"}
            />
          </ToggleOption>

          <ToggleOption
            bind:checked={showBaseMapOutline}
            label="Base map outline"
            description=""
            color="var(--color-accent-tertiary)"
          >
            {#if showBaseMapOutline}
              <Eye
                size={16}
                strokeWidth={2.2}
                class="text-[var(--color-accent-tertiary)]"
              />
            {:else}
              <EyeOff size={16} strokeWidth={2.2} class="text-muted" />
            {/if}
          </ToggleOption>

          <ToggleOption
            bind:checked={forceShowStations}
            label="Stations"
            description=""
            color="var(--color-accent-secondary)"
          >
            <Circle
              size={16}
              strokeWidth={2.2}
              class={forceShowStations
                ? "text-[var(--color-accent-secondary)]"
                : "text-muted"}
            />
          </ToggleOption>

          <div class="px-2.5 py-2">
            <div class="flex items-center justify-between mb-1.5">
              <span
                class="text-xs font-medium text-[var(--color-text-secondary)]"
                >Station size</span
              >
              <span class="text-[10px] text-muted tabular-nums"
                >{stationSizeMultiplier.toFixed(1)}×</span
              >
            </div>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              bind:value={stationSizeMultiplier}
              class="w-full h-1 rounded-full appearance-none cursor-pointer bg-[var(--color-switch-off)] accent-[var(--color-accent-secondary)]"
            />
            <div class="flex justify-between mt-1">
              <span class="text-[9px] text-muted">0.5×</span>
              <span class="text-[9px] text-muted">3×</span>
            </div>
          </div>

          <div class="border-t border-border mt-1 pt-1">
            <ToggleOption
              bind:checked={showRegionPolygon}
              label="Region polygon"
              description="Debug"
              color="var(--color-accent-secondary)"
            >
              <Scan
                size={16}
                strokeWidth={2.2}
                class={showRegionPolygon
                  ? "text-[var(--color-accent-secondary)]"
                  : "text-muted"}
              />
            </ToggleOption>
          </div>
        </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
