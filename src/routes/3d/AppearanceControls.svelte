<svelte:options runes={true} />

<script>
  // 3D display options injected into the LineSelector's appearance tab:
  // depth exaggeration, station labels/visibility, scene toggles and camera
  // presets. All values are bound back to the parent scene state; camera
  // presets are dispatched through the `onsetcamera` callback.
  let {
    exaggeration = $bindable(),
    labelTier = $bindable(),
    forceShowStations = $bindable(),
    stationSizeMultiplier = $bindable(),
    showTrains = $bindable(),
    styleGlow = $bindable(),
    autoRotate = $bindable(),
    showPillars = $bindable(),
    showGrid = $bindable(),
    onsetcamera,
  } = $props();

  const LABEL_TIERS = [
    ["none", "なし"],
    ["major", "主要駅"],
    ["all", "全駅"],
  ];
  const CAMERA_PRESETS = [
    ["bird", "鳥瞰"],
    ["top", "真上"],
    ["side", "断面（横）"],
    ["below", "地底から"],
  ];
</script>

<div class="p-3 overflow-y-auto">
  <div class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0">
    DEPTH 深さ表現
  </div>
  <div class="flex items-center gap-2 text-xs text-secondary">
    <span class="whitespace-nowrap">強調倍率</span>
    <input
      class="flex-1"
      type="range"
      min="1"
      max="40"
      step="1"
      bind:value={exaggeration}
    />
    <b class="text-accent-secondary">×{exaggeration}</b>
  </div>

  <div class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0">
    LABELS 駅名表示
  </div>
  <div class="flex gap-1">
    {#each LABEL_TIERS as [tier, label] (tier)}
      <button
        class="flex-1 border border-border text-xs py-1 rounded-md cursor-pointer {labelTier ===
        tier
          ? 'bg-[#1c3a66] text-primary'
          : 'bg-[var(--color-surface-soft)] text-secondary'}"
        onclick={() => (labelTier = tier)}>{label}</button
      >
    {/each}
  </div>

  <div class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0">
    STATIONS 駅表示
  </div>
  <label
    class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
    ><input type="checkbox" bind:checked={forceShowStations} /> ズームに関係なく表示</label
  >
  <div class="flex items-center gap-2 text-xs text-secondary">
    <span class="whitespace-nowrap">サイズ</span>
    <input
      class="flex-1"
      type="range"
      min="0.5"
      max="3"
      step="0.1"
      bind:value={stationSizeMultiplier}
    />
    <b class="text-accent-secondary">×{stationSizeMultiplier.toFixed(1)}</b>
  </div>

  <div class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0">
    DISPLAY 表示
  </div>
  <label
    class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
    ><input type="checkbox" bind:checked={showTrains} /> 列車の運行</label
  >
  <label
    class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
    ><input type="checkbox" bind:checked={styleGlow} /> グロー効果</label
  >
  <label
    class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
    ><input type="checkbox" bind:checked={autoRotate} /> 自動回転</label
  >
  <label
    class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
    ><input type="checkbox" bind:checked={showPillars} /> 模型支柱（地上との接続）</label
  >
  <label
    class="flex items-center gap-2 text-xs text-secondary py-1 cursor-pointer"
    ><input type="checkbox" bind:checked={showGrid} /> 地上グリッド</label
  >

  <div class="text-xxs tracking-[0.25em] text-muted mt-3.5 mb-1.5 first:mt-0">
    CAMERA 視点
  </div>
  <div class="grid grid-cols-2 gap-1.5">
    {#each CAMERA_PRESETS as [preset, label] (preset)}
      <button
        class="bg-[var(--color-surface-soft)] border border-border text-secondary text-xs py-2 rounded-lg cursor-pointer hover:bg-[var(--color-surface-hover)]"
        onclick={() => onsetcamera(preset)}>{label}</button
      >
    {/each}
  </div>

  <div class="mt-3.5 text-xxs leading-relaxed text-very-muted">
    深さは概算値（実測データではありません）。ダイヤは合成。 データ: 国土数値情報
    (N02-19)
  </div>
</div>
