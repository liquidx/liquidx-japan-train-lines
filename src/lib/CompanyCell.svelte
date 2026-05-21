<script>
  import { companyNameMapping } from "$lib/line-name-mapping.js";

  export let company; // { company: string, lines: string[] }
  export let selected = false;
</script>

<button
  class="flex flex-row justify-between items-center flex-nowrap gap-2 w-full text-muted cursor-pointer text-left transition-all duration-200 p-2 rounded-lg mb-1.5 hover:bg-selected-background hover:text-secondary {selected
    ? 'bg-selected-background text-accent-primary'
    : 'bg-transparent'}"
  on:click
>
  <div
    class="flex flex-col min-w-0 {selected
      ? 'text-accent-primary'
      : 'text-muted'}"
  >
    <span class="text-sm font-medium">{company.company}</span>
    {#if companyNameMapping[company.company]?.en}
      <span class="text-xxs">{companyNameMapping[company.company].en}</span>
    {/if}
  </div>
  <div
    class="flex justify-center items-center text-xxs px-2 py-1 bg-chip-background rounded-full min-w-6 h-6 shrink-0"
  >
    <span>{company.lines.length}</span>
  </div>
</button>
