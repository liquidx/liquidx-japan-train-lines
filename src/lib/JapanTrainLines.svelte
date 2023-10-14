<script>
  import { onMount } from "svelte";
  import { loadTrainLines, drawTrainLine } from "$lib/japan-train-lines.js";

  export let railroadGeoJsonUrl = "/railroad.geojson";
  let viewerEl;
  let trainCompanyNames = [];
  let selectedCompany = "東日本旅客鉄道";
  let selectedLine = "山手線";

  onMount(async () => {
    let data = await loadTrainLines({ railroadGeoJsonUrl });
    trainCompanyNames = data.trainCompanyNames;
    drawTrainLine(selectedCompany, selectedLine, viewerEl);
    registerKeyboardShortcuts({ viewerEl });
  });

  const didSelectLine = (e) => {
    let element = e.target;
    selectedCompany = element.getAttribute("data-company");
    selectedLine = element.getAttribute("data-line");
    drawTrainLine(selectedCompany, selectedLine, viewerEl);
  };
  const didSelectCompany = (e) => {
    let element = e.target;
    selectedCompany = element.getAttribute("data-company");
    selectedLine = null;
    drawTrainLine(selectedCompany, selectedLine, viewerEl);
  };

  const registerKeyboardShortcuts = () => {
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        getNext();
        drawTrainLine(selectedCompany, selectedLine, viewerEl);
      }
    });
  };

  const getNext = () => {
    let nextLine = getNextLine();
    if (selectedLine == nextLine) {
      selectedCompany = getNextCompany();
      selectedLine = getNextLine();
    } else {
      selectedLine = nextLine;
    }
    console.log(selectedCompany, selectedLine);
  };

  const getNextLine = () => {
    let company = trainCompanyNames.find(
      (company) => company.company === selectedCompany
    );
    let lineIndex = company.lines.indexOf(selectedLine);
    if (lineIndex === company.lines.length - 1) {
      return selectedLine;
    } else {
      return company.lines[lineIndex + 1];
    }
  };

  const getNextCompany = () => {
    let companyIndex = trainCompanyNames.findIndex(
      (company) => company.company === selectedCompany
    );
    if (companyIndex === trainCompanyNames.length - 1) {
      return trainCompanyNames[0].company;
    } else {
      return trainCompanyNames[companyIndex + 1].company;
    }
  };
</script>

<div id="viewer-container">
  <div id="controls">
    {#each trainCompanyNames as company}
      <div>
        <a
          href="#x"
          class="train-company"
          data-company={company.company}
          on:click={didSelectCompany}>{company.company}</a
        >
      </div>
      {#each company.lines as line}
        <div>
          <a
            href="#x"
            class="train-line"
            data-company={company.company}
            data-line={line}
            on:click={didSelectLine}>{line}</a
          >
        </div>
      {/each}
    {/each}
  </div>
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
