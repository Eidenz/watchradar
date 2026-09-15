<script lang="ts">
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  let { page, pages, onchange }: { page: number; pages: number; onchange: (p: number) => void } = $props();
  const around = $derived.by(() => {
    const set = new Set<number>([1, pages, page - 1, page, page + 1]);
    return [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  });
</script>

{#if pages > 1}
  <nav class="pg" aria-label="Pagination">
    <button class="icon-btn icon-btn-solid" disabled={page <= 1} onclick={() => onchange(page - 1)} aria-label="Previous"><ChevronLeft size={18} /></button>
    {#each around as p, i}
      {#if i > 0 && around[i - 1] !== p - 1}<span class="gap">…</span>{/if}
      <button class="num" data-active={p === page} onclick={() => onchange(p)}>{p}</button>
    {/each}
    <button class="icon-btn icon-btn-solid" disabled={page >= pages} onclick={() => onchange(page + 1)} aria-label="Next"><ChevronRight size={18} /></button>
  </nav>
{/if}

<style>
  .pg { display: flex; align-items: center; justify-content: center; gap: 0.35rem; margin-top: 1.5rem; }
  .num { min-width: 2.25rem; height: 2.25rem; padding: 0 0.5rem; border-radius: var(--radius-sm); font-weight: 600; color: rgb(var(--c-text-2)); transition: all var(--dur-2) var(--ease); }
  .num:hover { background: rgb(var(--c-subtle)); color: rgb(var(--c-text-1)); }
  .num[data-active='true'] { background: rgb(var(--c-brand)); color: rgb(var(--c-on-brand)); }
  .gap { color: rgb(var(--c-text-3)); padding: 0 0.2rem; }
</style>
