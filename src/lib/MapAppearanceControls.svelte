<script>
  import { createEventDispatcher } from "svelte";
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
  } from "@lucide/svelte";
  import ToggleOption from "$lib/ToggleOption.svelte";

  export let mapTheme = "dark";
  export let showLineColors = true;
  export let showBaseMapOutline = true;
  export let forceShowStations = false;
  export let stationSizeMultiplier = 1;

  let collapsed = true;

  const dispatch = createEventDispatcher();
</script>

<!-- Zoom Controls (top-right) -->
<div class="hud-controls absolute top-5 right-5 z-[5]">
  <div
    class="flex flex-col gap-2 bg-panel-background backdrop-blur-md p-1.5 rounded-xl border border-border shadow-[var(--shadow-panel)]"
  >
    <button
      on:click={() => dispatch("zoomIn")}
      title="Zoom In"
      aria-label="Zoom In"
      class="w-9 h-9 rounded-lg border-none bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-accent-secondary active:bg-[var(--color-accent-secondary-soft)] active:text-accent-secondary"
    >
      <Plus size={18} strokeWidth={2.5} />
    </button>
    <button
      on:click={() => dispatch("zoomOut")}
      title="Zoom Out"
      aria-label="Zoom Out"
      class="w-9 h-9 rounded-lg border-none bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-accent-secondary active:bg-[var(--color-accent-secondary-soft)] active:text-accent-secondary"
    >
      <Minus size={18} strokeWidth={2.5} />
    </button>
    <button
      on:click={() => dispatch("reset")}
      title="Reset View"
      aria-label="Reset View"
      class="w-9 h-9 rounded-lg border-none bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-accent-secondary active:bg-[var(--color-accent-secondary-soft)] active:text-accent-secondary"
    >
      <RotateCcw size={16} strokeWidth={2.5} />
    </button>
  </div>
</div>

<!-- Map Appearance Panel (bottom-right, collapsible) -->
<div class="hud-controls absolute bottom-5 right-5 z-[5] w-54">
  <div
    class="bg-panel-background backdrop-blur-md rounded-xl border border-border shadow-[var(--shadow-panel)] overflow-hidden transition-colors duration-200"
  >
    <button
      class="w-full h-10 flex items-center gap-2 px-3.5 bg-[var(--color-surface-soft)] cursor-pointer transition-colors duration-200 hover:bg-[var(--color-surface-hover)]"
      on:click={() => (collapsed = !collapsed)}
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
            on:click={() => (mapTheme = "dark")}
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
            on:click={() => (mapTheme = "light")}
            aria-pressed={mapTheme === "light"}
          >
            <Sun size={14} strokeWidth={2.2} />
            Light
          </button>
        </div>

        <ToggleOption
          bind:checked={showLineColors}
          label="Line colors"
          description={""}
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
          description={""}
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
          description={""}
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
      </div>
    {/if}
  </div>
</div>
