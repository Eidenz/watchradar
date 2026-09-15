<script lang="ts">
  // 10-point rating rendered as 5 stars with half steps. Click a star's left half for .5.
  import { Star } from '@lucide/svelte';
  interface Props {
    value: number | null;
    onchange?: (v: number | null) => void;
    readonly?: boolean;
    size?: number;
    showValue?: boolean;
  }
  let { value, onchange, readonly = false, size = 22, showValue = true }: Props = $props();
  let hover = $state<number | null>(null);
  const shown = $derived(hover ?? value ?? 0);

  function pick(e: MouseEvent, star: number) {
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const half = e.clientX - r.left < r.width / 2;
    return star * 2 - (half ? 1 : 0);
  }
  function click(e: MouseEvent, star: number) {
    if (readonly) return;
    const v = pick(e, star);
    onchange?.(v === value ? null : v);
  }
  function move(e: MouseEvent, star: number) {
    if (readonly) return;
    hover = pick(e, star);
  }
  const fill = (star: number) => Math.max(0, Math.min(1, (shown - (star - 1) * 2) / 2));
</script>

<div class="stars" class:readonly role={readonly ? 'img' : 'group'} aria-label="Rating {value ? value / 2 : 'none'} of 5" onmouseleave={() => (hover = null)}>
  {#each [1, 2, 3, 4, 5] as star}
    <button type="button" class="star" style:width="{size}px" style:height="{size}px" onclick={(e) => click(e, star)} onmousemove={(e) => move(e, star)} disabled={readonly} aria-label="{star} stars">
      <Star size={size} class="base" />
      <span class="fillwrap" style:width="{fill(star) * 100}%"><Star size={size} class="filled" /></span>
    </button>
  {/each}
  {#if showValue}
    <span class="val" class:none={!shown}>{shown ? (shown / 2).toFixed(1).replace('.0', '') : '—'}</span>
  {/if}
</div>

<style>
  .stars { display: inline-flex; align-items: center; gap: 0.1rem; }
  .star { position: relative; display: inline-grid; place-items: center; color: rgb(var(--c-border-strong)); transition: transform var(--dur-2) var(--ease-spring); }
  .star:not(:disabled):hover { transform: scale(1.18); }
  .star:disabled { cursor: default; }
  .fillwrap { position: absolute; left: 0; top: 0; height: 100%; overflow: hidden; color: rgb(var(--c-signal)); pointer-events: none; transition: width var(--dur-1) var(--ease); }
  .fillwrap :global(.filled) { fill: currentColor; }
  .val { margin-left: 0.4rem; font-weight: 700; font-size: 0.9rem; min-width: 1.6rem; }
  .val.none { color: rgb(var(--c-text-3)); font-weight: 500; }
</style>
