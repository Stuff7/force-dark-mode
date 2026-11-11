<script lang="ts">
  import Inspector from "./Inspector.svelte";
  import { zap } from "./ZapOverlay.svelte";

  let inspectorOpen = $state(true);
</script>

<form
  class="fixed z-5 bg-zinc-800 text-zinc-200 w-[380px] border border-zinc-600 rounded-lg pointer-events-auto flex flex-col cursor-grab shadow-xl shadow-black/40"
  class:cursor-grabbing={zap.dragging}
  style="left: {zap.dragX}px; top: {zap.dragY}px;"
  onsubmit={(ev) => zap.addToBlacklist(ev)}
>
  <div
    class="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-700 cursor-grab"
    class:cursor-grabbing={zap.dragging}
    onpointerdown={(ev) => zap.startDrag(ev.currentTarget, ev)}
  >
    <h2 class="text-sm font-semibold tracking-wide text-zinc-200 select-none">
      ⚡ Zap Selector
    </h2>
    <button
      type="button"
      class="danger compact h-6 w-6"
      onclick={() => zap.closeEditor()}
    >
      ×
    </button>
  </div>

  <div class="flex flex-col gap-2 p-3">
    <div class="flex items-center gap-2">
      <input
        class="flex-1 bg-zinc-700"
        type="range"
        min={0}
        max={9}
        bind:value={zap.specificityValue}
        oninput={() => zap.tweakSpecificity()}
      />
      <span class="text-xs text-zinc-300 shrink-0">
        <strong class="text-white">{zap.matchCount}</strong> matches
      </span>
    </div>

    <textarea
      class="bg-zinc-900/60 text-zinc-200 p-2 rounded border border-zinc-600 resize-y font-mono text-xs"
      rows="3"
      bind:value={zap.selectorValue}
      oninput={() => zap.highlightElems()}
    ></textarea>

    {#if zap.selectorInBlacklist}
      <button
        type="button"
        onclick={(ev) => zap.removeSelectorValueFromBlacklist(ev)}
        class="danger"
      >
        Remove
      </button>
    {:else}
      <button type="submit" class="primary">
        <span class="text-bg bg-white">Add To Blacklist</span>
      </button>
    {/if}
  </div>

  <div class="border-t border-zinc-700">
    <button
      type="button"
      class="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-wide text-zinc-300 hover:bg-zinc-700/50 rounded-none"
      onclick={() => (inspectorOpen = !inspectorOpen)}
    >
      <span>🔍 Inspector</span>
      <span class="text-zinc-500">{inspectorOpen ? "▾" : "▸"}</span>
    </button>

    {#if inspectorOpen}
      <div class="p-3 pt-0">
        <Inspector root={document.documentElement} />
      </div>
    {/if}
  </div>
</form>
