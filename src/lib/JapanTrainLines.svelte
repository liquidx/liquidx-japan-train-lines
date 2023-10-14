<script>
  import { onMount } from "svelte";
  import { render } from "$lib/japan-train-lines.js";

  export let railroadGeoJsonUrl = "/railroad.geojson";
  let controlEl;
  let viewerEl;

  onMount(() => {
    console.log("onMount", controlEl);
    render({ railroadGeoJsonUrl, controlEl, viewerEl });
  });
</script>

<div id="viewer-container">
  <div id="controls" bind:this={controlEl} />
  <div id="svg-viewer" bind:this={viewerEl} />
</div>

<style>
  #viewer-container {
    display: flex;
    min-height: 100vh;
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-y: hidden;
  }

  #controls {
    padding: 10px;
    width: 20vw;
    height: 100vh;
    background-color: rgba(200, 200, 200, 1);
    overflow-y: scroll;
  }

  #svg-viewer {
    flex: 1 1 auto;
    order: 2;
    padding: 10px;

    display: flex;
    align-items: center;
    justify-content: center;
  }

  a.train-company,
  a.train-line {
    display: block;
    color: rgba(33, 33, 33, 1);
  }

  a.train-company:visited,
  a.train-line:visited {
    color: rgba(33, 33, 33, 1);
  }

  a.train-line {
    margin-left: 20px;
  }

  a.line.selected {
    background-color: rgb(248, 234, 190);
  }
</style>
