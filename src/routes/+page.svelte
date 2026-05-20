<script>
  import JapanTrainLines from "$lib/JapanTrainLines.svelte";

  let geojsonUrl = "/N02-19_RailroadSection.geojson";
  let stationGeojsonUrl = "/N02-19_Station.geojson";
</script>

<JapanTrainLines railroadGeoJsonUrl={geojsonUrl} stationGeoJsonUrl={stationGeojsonUrl} />
