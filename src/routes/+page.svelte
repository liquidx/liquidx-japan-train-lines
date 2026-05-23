<script>
  import "../app.css";
  import JapanTrainLines from "$lib/JapanTrainLines.svelte";
import { dev } from '$app/environment';
import { injectAnalytics } from '@vercel/analytics/sveltekit';

injectAnalytics({ mode: dev ? 'development' : 'production' });

  let geojsonUrl = "/N02-19_RailroadSection.geojson";
  let stationGeojsonUrl = "/N02-19_Station.geojson";
  let japanOutlineGeojsonUrl = "/japan-outline.geojson";
</script>

<svelte:head>
  <title>Japan Train Line Maps | liquidx.net</title>
  <meta name="description" content="Interactive train line maps for Japan" />
</svelte:head>

<JapanTrainLines
  railroadGeoJsonUrl={geojsonUrl}
  stationGeoJsonUrl={stationGeojsonUrl}
  japanOutlineGeoJsonUrl={japanOutlineGeojsonUrl}
/>
