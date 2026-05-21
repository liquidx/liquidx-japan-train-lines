<script>
  import {
    lineNameMapping,
    companyNameMapping,
  } from "$lib/line-name-mapping.js";
  import { getLineColor } from "$lib/line-colors.js";

  export let line;
  export let company;
  export let selected = false;

  const dotColor = (c, l) => {
    const hex = getLineColor(c, l);
    return hex ?? "var(--color-text-faint)";
  };

  const linePrimaryName = (l) => {
    if (lineNameMapping[l] && lineNameMapping[l].ja) {
      return lineNameMapping[l].ja;
    }
    return l;
  };
</script>

<button
  class="group flex flex-row justify-between items-center flex-nowrap gap-2 w-full text-muted cursor-pointer text-left transition-all duration-200 p-2 rounded-lg mb-1.5 hover:bg-selected-background hover:text-secondary {selected
    ? 'bg-[var(--color-accent-secondary-soft)] border-[color:var(--color-accent-secondary-border)] text-[var(--color-accent-tertiary)] shadow-[0_0_10px_var(--color-accent-secondary-soft)]'
    : ''}"
  on:click
>
  <span class="flex flex-col min-w-0">
    <span class="text-sm font-medium">{linePrimaryName(line)}</span>
    {#if lineNameMapping[line]?.en}
      <span class="text-[10px] opacity-60 mt-[1px]"
        >{lineNameMapping[line].en}</span
      >
    {/if}
  </span>
  <span
    class="w-2 h-2 rounded-full shrink-0 transition-all duration-200 group-hover:scale-125"
    style="background-color: {dotColor(company, line)}"
  ></span>
</button>
