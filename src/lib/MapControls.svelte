<script>
  import { createEventDispatcher } from "svelte";
  import {
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

  export let mapTheme = "dark";
  export let showLineColors = true;
  export let showBaseMapOutline = true;

  const dispatch = createEventDispatcher();
</script>

<div class="hud-controls absolute top-5 right-5 flex items-start gap-3 z-[5]">
  <div
    class="w-[232px] bg-panel-background backdrop-blur-md rounded-xl border border-border shadow-[var(--shadow-panel)] overflow-hidden transition-colors duration-200"
  >
    <div
      class="h-10 flex items-center gap-2 px-3.5 border-b border-border bg-[var(--color-surface-soft)]"
    >
      <SlidersHorizontal
        size={15}
        strokeWidth={2.3}
        class="text-[var(--color-accent-tertiary)]"
      />
      <h2
        class="m-0 text-[11px] font-semibold uppercase tracking-[0.6px] text-[var(--color-text-secondary)]"
      >
        Map Appearance
      </h2>
    </div>

    <div class="p-2">
      <div
        class="grid grid-cols-2 gap-1 mb-1 rounded-lg bg-[var(--color-surface-soft)] p-1 border border-border"
      >
        <button
          class="h-8 rounded-md border border-transparent flex items-center justify-center gap-1.5 text-[11px] font-semibold cursor-pointer transition-all duration-200 {mapTheme ===
          'dark'
            ? 'bg-[var(--color-accent-primary-soft)] border-border text-[var(--color-accent-primary)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}"
          on:click={() => (mapTheme = "dark")}
          aria-pressed={mapTheme === "dark"}
        >
          <Moon size={14} strokeWidth={2.2} />
          Dark
        </button>
        <button
          class="h-8 rounded-md border border-transparent flex items-center justify-center gap-1.5 text-[11px] font-semibold cursor-pointer transition-all duration-200 {mapTheme ===
          'light'
            ? 'bg-[var(--color-accent-primary-soft)] border-border text-[var(--color-accent-primary)]'
            : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]'}"
          on:click={() => (mapTheme = "light")}
          aria-pressed={mapTheme === "light"}
        >
          <Sun size={14} strokeWidth={2.2} />
          Light
        </button>
      </div>

      <button
        class="w-full min-h-11 rounded-lg border border-transparent bg-transparent px-2.5 py-2 flex items-center justify-between gap-3 text-left cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:border-border"
        on:click={() => (showLineColors = !showLineColors)}
        aria-pressed={showLineColors}
      >
        <span class="flex items-center gap-2.5 min-w-0">
          <Palette
            size={16}
            strokeWidth={2.2}
            class={showLineColors ? "text-primary" : "text-muted"}
          />
          <span class="flex flex-col min-w-0 leading-tight">
            <span class="text-xs font-semibold text-secondary">Line colors</span>
            <span class="text-[10px] text-muted truncate"
              >{showLineColors
                ? "Official colors where available"
                : "Single-color rendering"}</span
            >
          </span>
        </span>
        <span
          class="w-[34px] h-[18px] rounded-full relative shrink-0 transition-colors duration-200 {showLineColors
            ? 'bg-accent-primary'
            : 'bg-[var(--color-switch-off)]'}"
        >
          <span
            class="w-3 h-3 rounded-full bg-[var(--color-switch-knob)] absolute top-[3px] left-[3px] transition-transform duration-200 {showLineColors
              ? 'translate-x-4'
              : 'translate-x-0'}"
          ></span>
        </span>
      </button>

      <button
        class="w-full min-h-11 rounded-lg border border-transparent bg-transparent px-2.5 py-2 flex items-center justify-between gap-3 text-left cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:border-border"
        on:click={() => (showBaseMapOutline = !showBaseMapOutline)}
        aria-pressed={showBaseMapOutline}
      >
        <span class="flex items-center gap-2.5 min-w-0">
          {#if showBaseMapOutline}
            <Eye
              size={16}
              strokeWidth={2.2}
              class="text-[var(--color-accent-tertiary)]"
            />
          {:else}
            <EyeOff
              size={16}
              strokeWidth={2.2}
              class="text-[var(--color-text-muted)]"
            />
          {/if}
          <span class="flex flex-col min-w-0 leading-tight">
            <span
              class="text-xs font-semibold text-[var(--color-text-secondary)]"
              >Base map outline</span
            >
            <span class="text-[10px] text-[var(--color-text-muted)] truncate"
              >{showBaseMapOutline
                ? "Land outline visible"
                : "Land outline hidden"}</span
            >
          </span>
        </span>
        <span
          class="w-[34px] h-[18px] rounded-full relative shrink-0 transition-colors duration-200 {showBaseMapOutline
            ? 'bg-[var(--color-accent-tertiary)]'
            : 'bg-[var(--color-switch-off)]'}"
        >
          <span
            class="w-3 h-3 rounded-full bg-[var(--color-switch-knob)] absolute top-[3px] left-[3px] transition-transform duration-200 {showBaseMapOutline
              ? 'translate-x-4'
              : 'translate-x-0'}"
          ></span>
        </span>
      </button>
    </div>
  </div>

  <div
    class="flex flex-col gap-2 bg-panel-background backdrop-blur-md p-1.5 rounded-xl border border-border shadow-[var(--shadow-panel)]"
  >
    <button
      on:click={() => dispatch("zoomIn")}
      title="Zoom In"
      aria-label="Zoom In"
      class="w-9 h-9 rounded-lg border-none bg-transparent text-[var(--color-text-muted)] flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent-secondary)] active:bg-[var(--color-accent-secondary-soft)] active:text-[var(--color-accent-secondary)]"
    >
      <Plus size={18} strokeWidth={2.5} />
    </button>
    <button
      on:click={() => dispatch("zoomOut")}
      title="Zoom Out"
      aria-label="Zoom Out"
      class="w-9 h-9 rounded-lg border-none bg-transparent text-[var(--color-text-muted)] flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent-secondary)] active:bg-[var(--color-accent-secondary-soft)] active:text-[var(--color-accent-secondary)]"
    >
      <Minus size={18} strokeWidth={2.5} />
    </button>
    <button
      on:click={() => dispatch("reset")}
      title="Reset View"
      aria-label="Reset View"
      class="w-9 h-9 rounded-lg border-none bg-transparent text-[var(--color-text-muted)] flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent-secondary)] active:bg-[var(--color-accent-secondary-soft)] active:text-[var(--color-accent-secondary)]"
    >
      <RotateCcw size={16} strokeWidth={2.5} />
    </button>
  </div>
</div>
