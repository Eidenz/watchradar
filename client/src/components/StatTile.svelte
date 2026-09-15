<script lang="ts">
  import type { Snippet } from 'svelte';
  let { label, value, sub, icon, delay = 0 }: { label: string; value: string | number; sub?: string; icon?: Snippet; delay?: number } = $props();
</script>

<div class="tile card animate-rise" style:animation-delay="{delay}ms">
  {#if icon}<div class="ic">{@render icon()}</div>{/if}
  <div class="v">{value}</div>
  <div class="l">{label}</div>
  {#if sub}<div class="s faint">{sub}</div>{/if}
</div>

<style>
  .tile { padding: 1rem 1.125rem; position: relative; overflow: hidden; }
  .ic { position: absolute; right: 0.875rem; top: 0.875rem; color: rgb(var(--c-brand)); opacity: 0.8; }
  .v { font-size: 1.625rem; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; }
  .l { font-size: 0.8125rem; font-weight: 600; color: rgb(var(--c-text-2)); margin-top: 0.2rem; }
  .s { font-size: 0.75rem; margin-top: 0.1rem; }
</style>
