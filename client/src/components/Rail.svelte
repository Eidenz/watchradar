<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  let { title, icon, href, count, children, action }: { title: string; icon?: Snippet; href?: string; count?: number; children: Snippet; action?: Snippet } = $props();
  let el = $state<HTMLDivElement>();
  const scroll = (dir: number) => el?.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
</script>

<section class="rail">
  <div class="section-head">
    <h2>{#if icon}{@render icon()}{/if}{#if href}<a href={href} class="hl">{title}</a>{:else}{title}{/if}{#if count !== undefined}<span class="count">{count}</span>{/if}</h2>
    <div class="acts">
      {#if action}{@render action()}{/if}
      <button class="icon-btn icon-btn-sm arrows" onclick={() => scroll(-1)} aria-label="Scroll left"><ChevronLeft size={16} /></button>
      <button class="icon-btn icon-btn-sm arrows" onclick={() => scroll(1)} aria-label="Scroll right"><ChevronRight size={16} /></button>
    </div>
  </div>
  <div class="track" bind:this={el}>{@render children()}</div>
</section>

<style>
  .rail { margin-bottom: 1.75rem; }
  .hl:hover { color: rgb(var(--c-brand)); }
  .count { font-size: 0.75rem; font-weight: 700; color: rgb(var(--c-text-3)); background: rgb(var(--c-subtle)); padding: 0.05rem 0.45rem; border-radius: 999px; }
  .acts { display: flex; gap: 0.25rem; align-items: center; }
  .arrows { display: none; }
  @media (hover: hover) { .arrows { display: inline-flex; } }
  .track { display: flex; gap: 0.875rem; overflow-x: auto; scroll-snap-type: x proximity; padding: 0.25rem 0.125rem 0.75rem; margin: 0 -0.125rem; scrollbar-width: none; }
  .track::-webkit-scrollbar { display: none; }
  .track > :global(*) { flex: 0 0 auto; scroll-snap-align: start; }
</style>
