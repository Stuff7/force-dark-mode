<script lang="ts" module>
  import { untrack } from "svelte";
  import { zap } from "./ZapOverlay.svelte";
  import { elementMatchesQuery, getElementPath } from "./utils";

  function strictAncestors(el: Element): Element[] {
    return getElementPath(el).slice(0, -1);
  }

  export class InspectorState {
    root: Element;

    expanded = $state.raw(new Set<Element>());
    query = $state("");
    matched = $state.raw(new Set<Element>());
    matchList = $state<Element[]>([]);
    activeMatchIndex = $state(0);
    clickedElement = $state<Element>();
    activeMatch = $derived(
      this.matchList[this.activeMatchIndex] ?? this.clickedElement,
    );

    private rows = new Map<Element, Element>();

    constructor(root: Element) {
      this.root = root;
    }

    registerRow(el: Element, node: Element | undefined) {
      if (node) {
        this.rows.set(el, node);
      } else {
        this.rows.delete(el);
      }
    }

    expandAncestors(el: Element) {
      const next = new Set(this.expanded);
      for (const ancestor of strictAncestors(el)) {
        next.add(ancestor);
      }
      this.expanded = next;
    }

    click(el: Element) {
      this.matchList = [];
      this.matched = new Set();
      this.clickedElement = el;
    }

    toggle(el: Element) {
      const next = new Set(this.expanded);
      if (next.has(el)) {
        next.delete(el);
      } else {
        next.add(el);
      }
      this.expanded = next;
    }

    focusElement(el: Element) {
      this.expandAncestors(el);
      requestAnimationFrame(() => {
        this.rows.get(el)?.scrollIntoView({ block: "center" });
      });
    }

    runSearch() {
      this.clickedElement = undefined;

      if (!this.query.trim()) {
        this.matched = new Set();
        this.matchList = [];
        this.activeMatchIndex = 0;
        return;
      }

      const found: Element[] = [];
      const walk = (el: Element) => {
        if (elementMatchesQuery(el, this.query)) found.push(el);
        for (const child of Array.from(el.children)) walk(child);
      };
      walk(this.root);

      this.matchList = found;
      this.matched = new Set(found);
      this.activeMatchIndex = 0;

      if (found.length) this.focusElement(found[0]);
    }

    goToMatch(delta: number) {
      if (!this.matchList.length) return;
      this.activeMatchIndex =
        (this.activeMatchIndex + delta + this.matchList.length) %
        this.matchList.length;
      this.focusElement(this.matchList[this.activeMatchIndex]);
    }
  }
</script>

<script lang="ts">
  import InspectorNode from "./InspectorNode.svelte";

  const { root }: { root: Element } = $props();
  const inspector = new InspectorState(root);

  $effect(() => {
    root;
    zap.pickedElement;

    untrack(() => {
      const next = new Set(inspector.expanded);
      next.add(root);
      inspector.expanded = next;

      if (zap.pickedElement) inspector.focusElement(zap.pickedElement);
    });
  });
</script>

<div class="flex flex-col gap-2 min-h-0">
  <div class="flex items-center gap-1">
    <input
      type="text"
      class="flex-1 bg-zinc-700 text-zinc-200 px-2 py-1 rounded border border-zinc-600 font-mono text-xs"
      placeholder="Search elements..."
      bind:value={inspector.query}
      oninput={() => inspector.runSearch()}
      onkeydown={(ev) => {
        if (ev.key === "Enter") inspector.goToMatch(ev.shiftKey ? -1 : 1);
      }}
    />
    {#if inspector.matchList.length}
      <span class="text-xs text-zinc-400 shrink-0 tabular-nums">
        {inspector.activeMatchIndex + 1}/{inspector.matchList.length}
      </span>
      <button
        type="button"
        class="secondary compact px-1.5 py-1 text-xs"
        onclick={() => inspector.goToMatch(-1)}
      >
        ▲
      </button>
      <button
        type="button"
        class="secondary compact px-1.5 py-1 text-xs"
        onclick={() => inspector.goToMatch(1)}
      >
        ▼
      </button>
    {:else if inspector.query.trim()}
      <span class="text-xs text-zinc-500 shrink-0">No matches</span>
    {/if}
  </div>

  <ul
    class="overflow-auto max-h-56 rounded border border-zinc-700 bg-zinc-900/60 py-1"
  >
    <InspectorNode element={root} depth={0} {inspector} />
  </ul>
</div>
