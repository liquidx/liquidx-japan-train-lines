<script>
  export let checked = false;
  export let label = "";
  export let description = "";
  export let color = "var(--color-accent-primary)";
</script>

<button
  class="w-full min-h-11 rounded-lg border border-transparent bg-transparent px-2.5 py-2 flex items-center justify-between gap-3 text-left cursor-pointer transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:border-border"
  on:click={() => (checked = !checked)}
  aria-pressed={checked}
>
  <span class="flex items-center gap-2.5 min-w-0">
    <slot />
    <span class="flex flex-col min-w-0 leading-tight">
      <span class="text-xs font-medium text-[var(--color-text-secondary)]"
        >{label}</span
      >
      <span class="text-[10px] text-muted truncate">{description}</span>
    </span>
  </span>
  <span
    class="w-[34px] h-[18px] rounded-full relative shrink-0 transition-colors duration-200 bg-[var(--color-switch-off)]"
    style={checked ? `background-color: ${color}` : null}
  >
    <span
      class="w-3 h-3 rounded-full bg-[var(--color-switch-knob)] absolute top-[3px] left-[3px] transition-transform duration-200 {checked
        ? 'translate-x-4'
        : 'translate-x-0'}"
    ></span>
  </span>
</button>
