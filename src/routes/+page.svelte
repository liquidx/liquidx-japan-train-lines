<script>
  import JapanTrainLines from "$lib/JapanTrainLines.svelte";

  let geojsonUrl = "/N02-19_RailroadSection.geojson";
</script>

<JapanTrainLines railroadGeoJsonUrl={geojsonUrl} />
