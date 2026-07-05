<svelte:options runes={true} />

<script>
  import "../../app.css";
  import { onMount } from "svelte";
  import TrainMap3D from "./TrainMap3D.svelte";

  let railroadGeoJson = $state(null);
  let stationGeoJson = $state(null);
  let error = $state(null);

  onMount(async () => {
    try {
      const [rail, stations] = await Promise.all([
        fetch("/N02-19_RailroadSection.geojson").then((r) => r.json()),
        fetch("/N02-19_Station.geojson").then((r) => r.json()),
      ]);
      railroadGeoJson = rail;
      stationGeoJson = stations;
    } catch (e) {
      error = String(e);
    }
  });
</script>

<svelte:head>
  <title>Japan Train Lines — Tokyo 3D (v2) | liquidx.net</title>
  <meta
    name="description"
    content="Experimental 3D map of the Tokyo rail network with animated trains"
  />
</svelte:head>

{#if error}
  <div class="loading">Failed to load data: {error}</div>
{:else if railroadGeoJson && stationGeoJson}
  <TrainMap3D {railroadGeoJson} {stationGeoJson} />
{:else}
  <div class="loading">Loading railway data…</div>
{/if}

<style>
  .loading {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #04060c;
    color: #7484a3;
    font-size: 13px;
    letter-spacing: 0.2em;
    font-family: "Helvetica Neue", Arial, sans-serif;
  }
</style>
