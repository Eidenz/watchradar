<script lang="ts">
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  let { value = 0, tone = 'brand', height = 6 }: { value: number; tone?: 'brand' | 'radar' | 'signal'; height?: number } = $props();
  const t = new Tween(0, { duration: 500, easing: cubicOut });
  $effect(() => {
    t.target = Math.max(0, Math.min(100, value));
  });
</script>

<div class="bar" style:height="{height}px" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
  <div class="fill {tone}" style:width="{t.current}%"></div>
</div>

<style>
  .bar { width: 100%; background: rgb(var(--c-border)); border-radius: 999px; overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; background: rgb(var(--c-brand)); position: relative; }
  .fill.radar { background: rgb(var(--c-radar)); }
  .fill.signal { background: rgb(var(--c-signal)); }
  .fill::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.35), transparent); transform: translateX(-100%); animation: sheen 2.4s ease-in-out infinite; }
  @keyframes sheen { 60%, 100% { transform: translateX(100%); } }
</style>
