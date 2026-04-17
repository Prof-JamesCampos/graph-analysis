<script lang="ts">
  import type { App } from 'obsidian'
  import type AnalysisView from 'src/AnalysisView'
  import { ANALYSIS_TYPES, ICON, LINKED, NOT_LINKED } from 'src/Constants'
  import type { GraphAnalysisSettings, Subtype } from 'src/Interfaces'
  import type GraphAnalysisPlugin from 'src/main'
  import {
    classExt,
    dropPath,
    getImgBufferPromise,
    isImg,
    openMenu,
    openOrSwitch,
    presentPath,
    hoverPreview,
    isInVault,
    isLinked
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

  $: currSubtypeInfo = ANALYSIS_TYPES.find((sub) => sub.subtype === currSubtype)
  let frozen = false
  let currFile = app.workspace.getActiveFile()

  let resolution = 10
  interface ComponentResults {
    linked: boolean
    to: string
    resolved: boolean
    img: Promise<ArrayBuffer> | null
  }

  $: currNode = currFile?.path
  let size = 50
  let current_component: HTMLElement
  let newBatch: ComponentResults[] = []
  let visibleData: ComponentResults[] = []
  let page = 0
  let blockSwitch = false

  let { resolvedLinks } = app.metadataCache

  app.workspace.on('file-open', (activeFile) => {
    if (!frozen) {
      blockSwitch = true
      newBatch = []
      visibleData = []
      promiseSortedResults = null
      page = 0
      setTimeout(() => (currFile = activeFile), 100)
    }
  })

  onMount(() => {
    currNode = currFile?.path
  })

  $: promiseSortedResults =
    !plugin.g || !currNode
      ? null
      : plugin.g.algs['Louvain'](currNode, { resolution })
          .then((results: string[]) => {
            const componentResults: ComponentResults[] = []
            results.forEach((to) => {
              const resolved = !to.endsWith('.md') || isInVault(app, to)
              const linked = isLinked(resolvedLinks, currNode, to, false)
              const img =
                plugin.settings.showImgThumbnails && isImg(to)
                  ? getImgBufferPromise(app, to)
                  : null
              componentResults.push({
                linked,
                to,
                resolved,
                img,
              })
            })
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

<SubtypeOptions
  bind:currSubtypeInfo
  bind:currFile
  bind:frozen
  {app}
  {plugin}
  {view}
  bind:blockSwitch
  bind:newBatch
  bind:visibleData
  bind:promiseSortedResults
  bind:page
/>

<div class="GA-Control-Panel">
  <label for="resolution">Resolution: </label>
  <input
    name="resolution"
    type="range"
    min="1"
    max="20"
    bind:value={resolution}
    on:change={() => {
      if (!frozen) {
        blockSwitch = true
        newBatch = []
        visibleData = []
        promiseSortedResults = null
        page = 0
      }
    }}
  />
  <span>{resolution}</span>
</div>

<div class="GA-Results-Container" bind:this={current_component}>
  <div class="GA-Results">
    {#if promiseSortedResults}
      {#await promiseSortedResults then sortedResults}
        {#key sortedResults}
          {#each visibleData as node}
            {#if node.to !== currNode && node !== undefined}
              <div
                class="{node.linked ? LINKED : NOT_LINKED} {classExt(node.to)}"
                on:click={async (e) => await openOrSwitch(app, node.to, e)}
              >
                <span
                  on:contextmenu={(e) => openMenu(e, app)}
                  on:mouseover={(e) => hoverPreview(e, view, dropPath(node.to))}
                >
                  {#if node.linked}
                    <span class={ICON}>
                      <FaLink />
                    </span>
                  {/if}

                  <ExtensionIcon path={node.to} />

                  <span class="internal-link {node.resolved ? '' : 'is-unresolved'}">
                    {presentPath(node.to)}
                  </span>
                  {#if isImg(node.to)}
                    <ImgThumbnail img={node.img} />
                  {/if}
                </span>
              </div>
            {/if}
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
          
          <div class="GA-Results-Footer">
            {visibleData.length} / {sortedResults.length}
          </div>
        {/key}
      {/await}
    {/if}
  </div>
</div>

<style>
  .GA-Results > div {
    padding: 2px 5px;
    cursor: pointer;
  }
  
  .GA-Results-Footer {
    padding: 10px;
    text-align: right;
    font-size: var(--font-size-small);
    color: var(--text-muted);
  }

  .is-unresolved {
    color: var(--text-muted);
  }

  .GA-node {
    overflow: hidden;
  }
  
  .GA-Control-Panel {
    padding: 10px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
</style>