<script lang="ts" module>
  import type { InspectorState } from "./Inspector.svelte";

  export type InspectorNodeProps = {
    element: Element;
    depth: number;
    inspector: InspectorState;
  };
</script>

<script lang="ts">
  import InspectorNode from "./InspectorNode.svelte";
  import { zap } from "./ZapOverlay.svelte";
  import { describeElement, elementMatchesBlacklist } from "./utils";

  const { element, depth, inspector }: InspectorNodeProps = $props();

  const children = $derived(
    Array.from(element.children).filter((el) => el.tagName !== "SCRIPT"),
  );
  const isExpanded = $derived(inspector.expanded.has(element));
  const isMatched = $derived(inspector.matched.has(element));
  const isActiveMatch = $derived(inspector.activeMatch === element);
  const isPicked = $derived(zap.pickedElement === element);
  const isBlacklisted = $derived(
    elementMatchesBlacklist(element, zap.blacklist),
  );
  const { tagName, id, classes } = $derived(describeElement(element));
</script>

<li>
  <div
    role="treeitem"
    aria-selected={isPicked}
    aria-expanded={children.length ? isExpanded : undefined}
    tabindex="0"
    class="group flex items-center gap-0.5 rounded-sm px-1 py-px font-mono text-xs leading-4 whitespace-nowrap cursor-default hover:bg-zinc-700/70"
    class:bg-sky-700={isPicked}
    class:hover:bg-sky-700={isPicked}
    class:outline={isMatched || isActiveMatch}
    class:outline-amber-500={isMatched && !isActiveMatch}
    class:outline-2={isActiveMatch}
    class:outline-amber-400={isActiveMatch}
    class:text-red-300={isBlacklisted && !isPicked}
    style="padding-left: {depth * 12 + 2}px"
    onclick={() => inspector.click(element)}
    ondblclick={() => inspector.toggle(element)}
    onpointerenter={() => zap.hoverInspectorElement(element)}
    onpointerleave={() => zap.hoverInspectorElement(undefined)}
    onkeydown={(ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        inspector.click(element);
      }
    }}
    {@attach (node) => {
      inspector.registerRow(element, node);
      return () => inspector.registerRow(element, undefined);
    }}
  >
    {#if children.length}
      <button
        type="button"
        class="compact w-3 shrink-0 text-center select-none text-zinc-400 hover:text-zinc-200"
        onclick={(ev) => {
          ev.stopPropagation();
          inspector.toggle(element);
        }}
      >
        {isExpanded ? "▾" : "▸"}
      </button>
    {:else}
      <span class="w-3 shrink-0"></span>
    {/if}

    <button
      type="button"
      class="compact shrink-0 text-zinc-400 hover:text-zinc-200"
      title="Select this node"
      onclick={(ev) => {
        ev.stopPropagation();
        zap.pickElement(element);
      }}
    >
      📋
    </button>

    {#if isBlacklisted}
      <button
        type="button"
        class="compact text-[10px]"
        title="Remove from blacklist"
        onclick={(ev) => {
          ev.stopPropagation();
          zap.removeElementFromBlacklist(element);
        }}
      >
        🗑️
      </button>
    {/if}

    <span class="text-sky-400">&lt;{tagName}</span>
    {#if id}
      <span class="text-amber-400">#{id}</span>
    {/if}
    {#each classes as cls}
      <span class="text-emerald-400">.{cls}</span>
    {/each}
    <span class="text-sky-400">&gt;</span>
  </div>

  {#if isExpanded && children.length}
    <ul>
      {#each children as child (child)}
        <InspectorNode element={child} depth={depth + 1} {inspector} />
      {/each}
    </ul>
  {/if}
</li>
