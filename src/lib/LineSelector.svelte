<script>
  import { createEventDispatcher } from "svelte";
  import { ArrowLeft, ChevronDown, ChevronUp } from "@lucide/svelte";
  import { companyNameMapping, lineNameMapping } from "$lib/line-name-mapping";
  import CompanyCell from "$lib/CompanyCell.svelte";
  import LineCell from "$lib/LineCell.svelte";

  export let regions = [];
  export let trainCompanyNames = [];
  export let selectedRegion = null;
  export let selectedCompany = null;
  export let selectedLine = null;

  const dispatch = createEventDispatcher();

  let mobileCollapsed = false;
  let mobileShowLines = false;

  const handleSelectCompany = (company) => {
    mobileShowLines = true;
    dispatch("selectcompany", company);
  };

  const handleSelectFullRegion = () => {
    mobileShowLines = false;
    dispatch("selectfullregionmap");
  };

  const handleMobileBack = () => {
    mobileShowLines = false;
  };

  const linePrimaryName = (selectedLine) => {
    if (lineNameMapping[selectedLine] && lineNameMapping[selectedLine].ja) {
      return lineNameMapping[selectedLine].ja;
    }
    return selectedLine;
  };

  const companyPrimaryName = (selectedCompany) => {
    if (
      companyNameMapping[selectedCompany] &&
      companyNameMapping[selectedCompany].ja
    ) {
      return companyNameMapping[selectedCompany].ja;
    }
    return selectedCompany;
  };

  $: if (!selectedCompany) {
    mobileShowLines = false;
  }
</script>

<section
  id="controls-panel"
  class="flex flex-col bg-panel-background z-5 transition-all duration-200
    {mobileCollapsed ? 'h-12' : 'h-[45vh]'} md:h-128"
>
  <!-- Mobile toggle bar (hidden on desktop) -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div
    class="md:hidden shrink-0 flex items-center justify-between px-4 h-12 border-b border-border cursor-pointer"
    on:click={() => (mobileCollapsed = !mobileCollapsed)}
    on:keydown={(e) =>
      e.key === "Enter" && (mobileCollapsed = !mobileCollapsed)}
    role="button"
    tabindex="0"
    aria-expanded={!mobileCollapsed}
  >
    <div class="flex items-center gap-2 min-w-0 overflow-hidden text-sm">
      {#if selectedCompany}
        <span class="text-accent-secondary font-medium truncate"
          >{companyPrimaryName(selectedCompany)}</span
        >
        {#if selectedLine}
          <span class="text-muted shrink-0">→</span>
          <span class="text-secondary truncate"
            >{linePrimaryName(selectedLine)}</span
          >
        {/if}
      {:else}
        <span class="text-muted">
          {regions.find((r) => r.id === selectedRegion)?.nameJa || "路線を選択"}
        </span>
      {/if}
    </div>
    {#if mobileCollapsed}
      <ChevronUp size={16} class="text-muted shrink-0 ml-2" />
    {:else}
      <ChevronDown size={16} class="text-muted shrink-0 ml-2" />
    {/if}
  </div>

  <!-- Panel content (hidden on mobile when collapsed) -->
  <div
    class="{mobileCollapsed
      ? 'hidden md:flex'
      : 'flex'} flex-col flex-1 overflow-hidden"
  >
    <!-- Region Selector Tabs -->
    <div
      class="flex bg-panel-background border-b border-border px-1 gap-1.5 py-1 items-center overflow-x-auto scrollbar-thin shrink-0"
    >
      {#each regions as r}
        <button
          class="flex items-center px-2 py-1 min-w-16 rounded-lg border cursor-pointer whitespace-nowrap transition-all duration-200 {selectedRegion ===
          r.id
            ? 'border-border text-accent-primary'
            : 'bg-transparent border-transparent text-muted hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)]'}"
          on:click={() => dispatch("selectregion", r.id)}
        >
          <div
            class="flex flex-col items-start leading-[1.1] {selectedRegion ===
            r.id
              ? 'text-accent-primary'
              : 'text-secondary'}"
          >
            <span class="text-sm font-medium">{r.nameJa}</span>
            <span class="text-xxs">{r.name}</span>
          </div>
        </button>
      {/each}
    </div>

    <!-- Desktop: two-column layout -->
    <div class="hidden md:flex flex-1 overflow-hidden">
      <!-- Left Column: Operating Companies -->
      <div
        class="flex flex-col h-full w-72 border-r border-border bg-[var(--color-panel-muted)]"
      >
        <div class="flex-1 overflow-y-auto p-3 scrollbar-thin">
          <button
            class="w-full text-muted cursor-pointer text-left transition-all duration-200 p-2 rounded-lg mb-1.5 hover:bg-selected-background {selectedCompany ===
              null && selectedLine === null
              ? 'bg-selected-background text-accent-primary'
              : 'bg-transparent'}"
            on:click={() => dispatch("selectfullregionmap")}
          >
            <div class="flex flex-col">
              <span class="text-sm text-secondary">
                {regions.find((r) => r.id === selectedRegion)?.nameJa || "全国"}
              </span>
              <span
                class="text-xxs text-secondary transition-colors {selectedCompany ===
                  null && selectedLine === null
                  ? 'text-accent-primary'
                  : 'text-secondary'}">All</span
              >
            </div>
          </button>

          {#each trainCompanyNames as company}
            <CompanyCell
              {company}
              selected={selectedCompany === company.company}
              on:click={() => dispatch("selectcompany", company.company)}
            />
          {/each}
        </div>
      </div>

      <!-- Right Column: Train Lines Grid -->
      <div class="flex flex-col h-full flex-1 bg-[var(--color-surface-soft)]">
        <div class="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {#if selectedCompany}
            <div
              class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2 w-full"
            >
              {#each trainCompanyNames.find((c) => c.company === selectedCompany)?.lines || [] as line}
                <LineCell
                  {line}
                  company={selectedCompany}
                  selected={selectedLine === line}
                  on:click={() =>
                    dispatch("selectline", { company: selectedCompany, line })}
                />
              {/each}
            </div>
          {:else}
            <div
              class="flex items-center justify-center h-full min-h-[200px] text-center text-muted"
            >
              <div class="max-w-[380px]">
                <span class="text-[32px] block mb-3 opacity-50">🗺️</span>
                <h3 class="text-muted text-[16px] font-medium m-[0_0_6px_0]">
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

    <!-- Mobile: single-column navigation -->
    <div class="flex md:hidden flex-col flex-1 overflow-hidden">
      {#if mobileShowLines && selectedCompany}
        <!-- Lines view with back button -->
        <div
          class="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-border bg-[var(--color-surface-soft)]"
        >
          <button
            class="flex items-center gap-1.5 text-sm text-muted hover:text-secondary cursor-pointer"
            on:click={handleMobileBack}
          >
            <ArrowLeft size={14} />
            <span>Companies</span>
          </button>
          <span class="text-border mx-0.5">·</span>
          <span class="text-sm text-accent-secondary font-medium truncate"
            >{selectedCompany}</span
          >
          <span class="ml-auto text-xxs text-muted shrink-0">
            {(
              trainCompanyNames.find((c) => c.company === selectedCompany)
                ?.lines || []
            ).length} lines
          </span>
        </div>
        <div class="flex-1 overflow-y-auto p-2 scrollbar-thin">
          <div class="grid grid-cols-2 gap-1.5">
            {#each trainCompanyNames.find((c) => c.company === selectedCompany)?.lines || [] as line}
              <LineCell
                {line}
                company={selectedCompany}
                selected={selectedLine === line}
                on:click={() =>
                  dispatch("selectline", { company: selectedCompany, line })}
              />
            {/each}
          </div>
        </div>
      {:else}
        <!-- Companies view -->
        <div class="flex-1 overflow-y-auto p-2 scrollbar-thin">
          <button
            class="w-full text-muted cursor-pointer text-left transition-all duration-200 p-[8px_12px] rounded-lg mb-2 hover:bg-[var(--color-accent-primary-soft)] {selectedCompany ===
              null && selectedLine === null
              ? 'bg-[var(--color-accent-primary-soft)] text-accent-primary'
              : 'bg-transparent'}"
            on:click={handleSelectFullRegion}
          >
            <div class="flex items-center gap-2.5">
              <span class="opacity-80">🌐</span>
              <div class="flex flex-col">
                <span class="text-sm text-secondary font-medium">
                  {regions.find((r) => r.id === selectedRegion)?.nameJa ||
                    "全国"}
                </span>
                <span class="text-xxs text-muted">All regional lines</span>
              </div>
            </div>
          </button>
          <div class="grid grid-cols-2 gap-1.5">
            {#each trainCompanyNames as company}
              <CompanyCell
                {company}
                selected={selectedCompany === company.company}
                on:click={() => handleSelectCompany(company.company)}
              />
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>
