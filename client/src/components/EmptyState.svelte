<script lang="ts">
  import type { Snippet } from 'svelte';
  let { icon, title, text, children }: { icon?: Snippet; title: string; text?: string; children?: Snippet } = $props();
</script>

<div class="empty animate-rise">
  {#if icon}<div class="ic">{@render icon()}</div>{/if}
  <h3>{title}</h3>
  {#if text}<p>{text}</p>{/if}
  {#if children}<div class="actions">{@render children()}</div>{/if}
</div>

<style>
  .actions { margin-top: 1rem; display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
</style>
