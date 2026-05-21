<script>
  import { createEventDispatcher } from "svelte";
  import {
    lineNameMapping,
    companyNameMapping,
  } from "$lib/line-name-mapping.js";

  export let regions = [];
  export let trainCompanyNames = [];
  export let selectedRegion = null;
  export let selectedCompany = null;
  export let selectedLine = null;

  const dispatch = createEventDispatcher();
</script>

<section
  id="controls-panel"
  class="h-[38vh] flex flex-col bg-[var(--color-panel-bg)] z-[5] transition-colors duration-200"
>
  <!-- Region Selector Tabs -->
  <div
    class="flex bg-[var(--color-panel-strong)] border-b border-border px-4 gap-1.5 h-12 items-center overflow-x-auto scrollbar-thin"
  >
    {#each regions as r}
      <button
        class="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-transparent border border-transparent text-[var(--color-text-muted)] cursor-pointer whitespace-nowrap transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] {selectedRegion ===
        r.id
          ? 'bg-[var(--color-accent-primary-soft)] border-border text-[var(--color-accent-primary)]'
          : ''}"
        on:click={() => dispatch("selectregion", r.id)}
      >
        <span
          class="w-1.5 h-1.5 rounded-full transition-all duration-200 border bg-transparent {selectedRegion ===
          r.id
            ? 'border-[color:var(--color-accent-primary)] bg-[var(--color-accent-primary)] shadow-[0_0_6px_var(--color-accent-primary)]'
            : 'border-border'}"
        ></span>
        <div class="flex flex-col items-start leading-[1.1]">
          <span class="text-[11px] font-semibold">{r.nameJa}</span>
          <span class="text-[9px] opacity-60 mt-[1px]">{r.name}</span>
        </div>
      </button>
    {/each}
  </div>

  <div class="flex flex-1 overflow-hidden">
    <!-- Left Column: Operating Companies -->
    <div
      class="flex flex-col h-full w-[320px] border-r border-border bg-[var(--color-panel-muted)]"
    >
      <div
        class="h-12 flex justify-between items-center px-5 border-b border-border bg-[var(--color-surface-soft)]"
      >
        <h2
          class="text-[14px] font-semibold m-0 text-[var(--color-text-secondary)] uppercase tracking-[0.5px]"
        >
          Operating Companies
        </h2>
        <span
          class="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] px-2 py-0.5 rounded-full"
          >{trainCompanyNames.length} total</span
        >
      </div>
      <div class="flex-1 overflow-y-auto p-3 scrollbar-thin">
        <button
          class="w-full border text-[var(--color-text-muted)] cursor-pointer text-left transition-all duration-200 p-[10px_14px] rounded-lg mb-1.5 hover:text-[var(--color-text-secondary)] border-dashed border-border hover:bg-[var(--color-accent-primary-soft)] {selectedCompany ===
            null && selectedLine === null
            ? 'bg-[var(--color-accent-primary-soft)] text-[var(--color-accent-primary)]'
            : 'bg-transparent'}"
          on:click={() => dispatch("selectfullregionmap")}
        >
          <div class="flex items-center gap-3">
            <span class="text-[16px] opacity-80">🌐</span>
            <div class="flex flex-col">
              <span class="text-sm font-medium">
                {regions.find((r) => r.id === selectedRegion)?.nameJa || "全国"} Map
              </span>
              <span
                class="text-[10px] mt-[1px] transition-colors {selectedCompany ===
                  null && selectedLine === null
                  ? 'text-[var(--color-accent-primary)] opacity-70'
                  : 'text-[var(--color-text-faint)]'}"
                >Show all regional lines overlay</span
              >
            </div>
          </div>
        </button>

        {#each trainCompanyNames as company}
          <button
            class="w-full border text-[var(--color-text-muted)] cursor-pointer text-left transition-all duration-200 p-[10px_14px] rounded-lg mb-1.5 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] {selectedCompany ===
            company.company
              ? 'bg-[var(--color-accent-secondary-soft)] border-[color:var(--color-accent-secondary-border)] text-[var(--color-accent-secondary)]'
              : 'border-transparent bg-transparent'}"
            on:click={() => dispatch("selectcompany", company.company)}
          >
            <div class="flex items-center gap-3">
              <span class="text-[16px] opacity-80">🏢</span>
              <div class="flex flex-col min-w-0">
                <span class="text-sm font-medium">{company.company}</span>
                {#if companyNameMapping[company.company]?.en}
                  <span class="text-[10px] opacity-60 mt-[1px]"
                    >{companyNameMapping[company.company].en}</span
                  >
                {/if}
                <span
                  class="text-[10px] mt-[1px] transition-colors {selectedCompany ===
                  company.company
                    ? 'text-[var(--color-accent-secondary)] opacity-70'
                    : 'text-[var(--color-text-faint)]'}"
                  >{company.lines.length} lines</span
                >
              </div>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Right Column: Train Lines Grid -->
    <div class="flex flex-col h-full flex-1 bg-[var(--color-surface-soft)]">
      <div
        class="h-12 flex justify-between items-center px-5 border-b border-border bg-[var(--color-surface-soft)]"
      >
        <h2
          class="text-[14px] font-semibold m-0 text-[var(--color-text-secondary)] uppercase tracking-[0.5px]"
        >
          {#if selectedCompany}
            {selectedCompany} Lines
          {:else}
            Select Company
          {/if}
        </h2>
        {#if selectedCompany}
          <span
            class="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface-soft)] px-2 py-0.5 rounded-full"
          >
            {(
              trainCompanyNames.find((c) => c.company === selectedCompany)
                ?.lines || []
            ).length} lines
          </span>
        {/if}
      </div>

      <div class="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {#if selectedCompany}
          <div
            class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 w-full"
          >
            {#each trainCompanyNames.find((c) => c.company === selectedCompany)?.lines || [] as line}
              <button
                class="group w-full border bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] cursor-pointer text-left transition-all duration-200 flex items-center gap-2.5 p-[12px_16px] rounded-lg border-border hover:bg-[var(--color-surface-hover)] hover:border-border hover:text-[var(--color-text-primary)] {selectedLine ===
                line
                  ? 'bg-[var(--color-accent-secondary-soft)] border-[color:var(--color-accent-secondary-border)] text-[var(--color-accent-tertiary)] shadow-[0_0_10px_var(--color-accent-secondary-soft)]'
                  : ''}"
                on:click={() => dispatch("selectline", { company: selectedCompany, line })}
              >
                <span
                  class="w-2 h-2 rounded-full shrink-0 transition-all duration-200 group-hover:scale-125"
                  style="background-color: {selectedLine === line
                    ? 'var(--color-accent-tertiary)'
                    : 'var(--color-text-faint)'}"
                ></span>
                <span class="flex flex-col min-w-0">
                  <span class="text-sm font-medium">{line}</span>
                  {#if lineNameMapping[line]?.en}
                    <span class="text-[10px] opacity-60 mt-[1px]"
                      >{lineNameMapping[line].en}</span
                    >
                  {/if}
                </span>
              </button>
            {/each}
          </div>
        {:else}
          <div
            class="flex items-center justify-center h-full min-h-[200px] text-center text-[var(--color-text-muted)]"
          >
            <div class="max-w-[380px]">
              <span class="text-[32px] block mb-3 opacity-50">🗺️</span>
              <h3
                class="text-[var(--color-text-muted)] text-[16px] font-semibold m-[0_0_6px_0]"
              >
                No Company Selected
              </h3>
              <p class="text-xs leading-relaxed m-0">
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
