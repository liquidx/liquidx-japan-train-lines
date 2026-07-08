<svelte:options runes={true} />

<script>
  import { Play, Pause } from "@lucide/svelte";
  import { formatClock, SERVICE_START, SERVICE_END } from "./schedule.js";

  // Play/pause, clock scrubber and speed presets for the schedule animation.
  // Rendered in the LineSelector's footer slot so it stays visible when the
  // panel is collapsed.
  let {
    playing = $bindable(),
    clockSec = $bindable(),
    speed = $bindable(),
  } = $props();

  const SPEEDS = [1, 60, 120, 300, 600];

  const scrub = (e) => {
    clockSec = Number(e.target.value);
  };
</script>

<div
  class="border-t border-border px-2.5 py-2 flex flex-col gap-1.5 flex-none"
>
  <div class="flex items-center gap-2">
    <button
      class="flex items-center justify-center bg-transparent border-none text-primary cursor-pointer w-6 flex-none"
      onclick={() => (playing = !playing)}
      aria-label={playing ? "一時停止" : "再生"}
    >
      {#if playing}
        <Pause size={13} strokeWidth={2.5} />
      {:else}
        <Play size={13} strokeWidth={2.5} />
      {/if}
    </button>
    <div class="text-xs font-bold tabular-nums text-primary min-w-11">
      {formatClock(clockSec)}
    </div>
    <input
      class="flex-1 min-w-0 accent-[var(--color-accent-secondary)]"
      type="range"
      min={SERVICE_START}
      max={SERVICE_END}
      step="60"
      value={clockSec}
      oninput={scrub}
    />
  </div>
  <div class="flex items-center gap-1">
    {#each SPEEDS as s (s)}
      <button
        class="flex-1 border border-border text-xxs py-1 rounded-md cursor-pointer {speed ===
        s
          ? 'bg-[#1c3a66] text-primary'
          : 'bg-[var(--color-surface-soft)] text-secondary'}"
        onclick={() => (speed = s)}>×{s}</button
      >
    {/each}
  </div>
</div>
