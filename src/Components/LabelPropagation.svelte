<script lang="ts">
  import type { App } from 'obsidian'
  import { hoverPreview, isLinked, isInVault } from 'src/Utility'
  import type AnalysisView from 'src/AnalysisView'
  import { ANALYSIS_TYPES, ICON, MEASURE, NODE } from 'src/Constants'
  import type {
    Communities,
    GraphAnalysisSettings,
    Subtype,
  } from 'src/Interfaces'
  import type GraphAnalysisPlugin from 'src/main'
  import {
    classExt,
    classLinked,
    classResolved,
    getImgBufferPromise,
    isImg,
    openMenu,
    openOrSwitch,
    presentPath,
  } from 'src/Utility'
  
  import { onMount } from 'svelte'
  import FaLink from 'svelte-icons/fa/FaLink.svelte'
  import InfiniteScroll from 'svelte-infinite-scroll'
  import ExtensionIcon from './ExtensionIcon.svelte'
  import ImgThumbnail from './ImgThumbnail.svelte'
  import SubtypeOptions from './SubtypeOptions.svelte'

  export let app: App
  export let plugin: GraphAnalysisPlugin
  //export let settings: GraphAnalysisSettings
  export let view: AnalysisView
  export let currSubtype: Subtype

  interface ComponentResults {
    label: string
    comm: string[]
  }

  let { resolvedLinks } = app.metadataCache

  $: currSubtypeInfo = ANALYSIS_TYPES.find((sub) => sub.subtype === currSubtype)
  let ascOrder = false
  let size = 50
  let current_component: HTMLElement
  let newBatch: ComponentResults[] = []
  let visibleData: ComponentResults[] = []
  let page = 0
  let blockSwitch = false

  let currFile = app.workspace.getActiveFile()
  $: currNode = currFile?.path
  app.workspace.on('file-open', (activeFile) => {
    blockSwitch = true
    setTimeout(() => {
      blockSwitch = false
      currFile = activeFile
    }, 100)
    newBatch = []
  })

  let its = 20
  const iterationsArr = Array(50)
    .fill(0)
    .map((_, j) => j + 1)

  $: promiseSortedResults = !plugin.g
    ? null
    : plugin.g.algs[currSubtype]('', { iterations: its })
        .then((comms: Communities) => {
          const greater = ascOrder ? 1 : -1
          const lesser = ascOrder ? -1 : 1

          const componentResults: ComponentResults[] = []
          Object.keys(comms).forEach((label) => {
            let comm = comms[label]
            if (comm.length > 1) {
              componentResults.push({
                label,
                comm,
              })
            }
          })
       
          componentResults.sort((a, b) =>
            a.comm.length > b.comm.length ? greater : lesser
          )
          return componentResults
        })
        .then((res) => {
          newBatch = res.slice(0, size)
          setTimeout(() => {
            blockSwitch = false
          }, 100)
          return res
        })

  $: visibleData = [...visibleData, ...newBatch]

  onMount(() => {
    currFile = app.workspace.getActiveFile()
  })
</script>

<div class="GA-CC-Container" bind:this={current_component}>
  <div class="GA-Header-Controls">
    <SubtypeOptions
      bind:currSubtypeInfo
      bind:ascOrder
      bind:blockSwitch
      bind:newBatch
      bind:visibleData
      bind:promiseSortedResults
      bind:page
      {plugin}
      {view}
      {app}
    />

    <div class="GA-Slider-Control">
      <label for="iterations">Iterations: {its}</label>
      <input
        name="iterations"
        type="range"
        min="1"
        max="30"
        bind:value={its}
        on:change={() => {
          blockSwitch = true
          visibleData = []
          promiseSortedResults = null
          page = 0
          setTimeout(() => {
            blockSwitch = false
          }, 100)
          newBatch = []
        }}
      />
    </div>
  </div>

  <div class="GA-CC-List">
    {#if promiseSortedResults}
      {#await promiseSortedResults then sortedResults}
        {#key sortedResults}
          {#each visibleData as comm}
            <div class="GA-CC">
              <details class="tree-item-self">
                <summary
                  class="tree-item-inner"
                  on:contextmenu={(e) =>
                    openMenu(e, app, { toCopy: comm.comm.join('\n') })}
                >
                  <span class="top-row {comm.comm.includes(currNode) ? 'currComm' : ''}">
                    <span class="GA-Label-Text">
                      {presentPath(comm.label)}
                    </span>
                    <span class={MEASURE}>{comm.comm.length}</span>
                  </span>
                </summary>
                <div class="GA-details">
                  {#each comm.comm as member}
                    <div
                      class="{NODE} {classLinked(resolvedLinks, comm.label, member)} {classResolved(app, member)} {classExt(member)}"
                      on:click={async (e) => await openOrSwitch(app, member, e)}
                      on:mouseover={(e) => hoverPreview(e, view, member)}
                    >
                      {#if isLinked(resolvedLinks, comm.label, member, false)}
                        <span class={ICON}>
                          <FaLink />
                        </span>
                      {/if}
                      <ExtensionIcon path={member} />
                      <span class="internal-link {currNode === member ? 'currNode' : ''}">
                        {presentPath(member)}
                      </span>
                      {#if plugin.settings.showImgThumbnails && isImg(member)}
                        <ImgThumbnail img={getImgBufferPromise(app, member)} />
                      {/if}
                    </div>
                  {/each}
                </div>
              </details>
            </div>
          {/each}

          <InfiniteScroll
            hasMore={sortedResults.length > visibleData.length}
            threshold={100}
            elementScroll={current_component?.parentNode}
            on:loadMore={() => {
              if (!blockSwitch) {
                page++
                newBatch = sortedResults.slice(size * page, size * (page + 1) - 1)
              }
            }}
          />
          
          <div class="GA-Footer-Stats">
            {visibleData.length} / {sortedResults.length}
          </div>
        {/key}
      {/await}
    {/if}
  </div>
</div>

<style>
  .GA-CC-Container {
    display: flex;
    flex-direction: column;
    padding-left: 10px;
  }

  .GA-Header-Controls {
    margin-bottom: 10px;
  }

  .GA-Slider-Control {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 5px;
  }

  .GA-Footer-Stats {
    padding: 10px;
    text-align: right;
    font-size: var(--font-size-small);
    color: var(--text-muted);
  }

  .is-unresolved {
    color: var(--text-muted);
  }

  .GA-details {
    padding-left: 20px;
  }

  .GA-node,
  .CC-sentence {
    font-size: var(--font-size-secondary);
    border: 1px solid transparent;
    border-radius: 5px;
    cursor: pointer;
  }

  .CC-sentence:hover {
    background-color: var(--background-secondary-alt);
  }

  .top-row {
    display: flex;
    justify-content: space-between;
    width: 100%;
    align-items: center;
  }

  span.GA-measure {
    background-color: var(--background-secondary-alt);
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
  }

  .currComm {
    color: var(--text-accent);
  }

  .currNode {
    font-weight: bold;
  }
</style>