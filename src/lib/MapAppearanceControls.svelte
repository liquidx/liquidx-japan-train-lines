<svelte:options runes={true} />

<script>
  import {
    ChevronUp,
    Circle,
    Eye,
    EyeOff,
    Minus,
    Moon,
    Palette,
    Plus,
    RotateCcw,
    SlidersHorizontal,
    Sun,
    Scan,
  } from "@lucide/svelte";
  import ToggleOption from "$lib/ToggleOption.svelte";

  let {
    mapTheme = $bindable("dark"),
    showLineColors = $bindable(true),
    showBaseMapOutline = $bindable(true),
    forceShowStations = $bindable(false),
    stationSizeMultiplier = $bindable(1),
    showRegionPolygon = $bindable(false),
    onzoomIn,
    onzoomOut,
    onreset,
  } = $props();

  let collapsed = $state(true);
</script>

<!-- Map Appearance Panel (bottom-right, collapsible) with zoom controls in header -->
<div
  class="hud-controls absolute bottom-5 right-5 z-10 max-w-84 hidden md:block"
  ontouchstart={(e) => e.stopPropagation()}
  ontouchmove={(e) => e.stopPropagation()}
  ontouchend={(e) => e.stopPropagation()}
>
  <div
    class="bg-panel-background backdrop-blur-md rounded-xl border border-border shadow-[var(--shadow-panel)] overflow-hidden transition-colors duration-200"
  >
    <div
      class="w-full h-10 flex items-center bg-[var(--color-surface-soft)] transition-colors duration-200 hover:bg-[var(--color-surface-hover)]"
    >
      <button
        class="flex items-center gap-2 px-3 flex-1 h-full cursor-pointer"
        onclick={() => (collapsed = !collapsed)}
        aria-expanded={!collapsed}
      >
        <SlidersHorizontal
          size={15}
          strokeWidth={2.3}
          class="text-[var(--color-accent-tertiary)]"
        />
        <h2
          class="m-0 text-[11px] font-medium uppercase tracking-[0.6px] text-[var(--color-text-secondary)] flex-1 text-left"
        >
          Map Appearance
        </h2>
        <ChevronUp
          size={13}
          strokeWidth={2.5}
          class="text-muted transition-transform duration-200 {collapsed
            ? 'rotate-180'
            : ''}"
        />
      </button>
      <div
        class="flex items-center gap-0.5 pr-1.5 pl-1 border-l border-border h-7"
      >
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

    {#if !collapsed}
      <div class="p-2">
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
            <span class="text-xs font-medium text-[var(--color-text-secondary)]"
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
              class={showRegionPolygon ? "text-[var(--color-accent-secondary)]" : "text-muted"}
            />
          </ToggleOption>
        </div>
      </div>
    {/if}
  </div>
</div>
