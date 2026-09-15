<script lang="ts">
  import { Film, Tv } from '@lucide/svelte';
  import { img } from '../lib/format';
  interface Props {
    path: string | null | undefined;
    alt?: string;
    size?: 'w92' | 'w185' | 'w342' | 'w500' | 'w780';
    type?: 'tv' | 'movie';
    radius?: string;
    eager?: boolean;
  }
  let { path, alt = '', size = 'w342', type = 'tv', radius = 'var(--radius-md)', eager = false }: Props = $props();
  let loaded = $state(false);
  let failed = $state(false);
  const src = $derived(img(path, size));
</script>

<div class="poster" style:border-radius={radius}>
  {#if src && !failed}
    <img {src} {alt} loading={eager ? 'eager' : 'lazy'} decoding="async" class:loaded onload={() => (loaded = true)} onerror={() => (failed = true)} />
    {#if !loaded}<div class="skeleton fill"></div>{/if}
  {:else}
    <div class="fallback">
      {#if type === 'movie'}<Film size={28} />{:else}<Tv size={28} />{/if}
    </div>
  {/if}
</div>

<style>
  .poster { position: relative; aspect-ratio: 2 / 3; width: 100%; overflow: hidden; background: rgb(var(--c-subtle)); }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity var(--dur-4) var(--ease); }
  img.loaded { opacity: 1; }
  .fill { position: absolute; inset: 0; border-radius: 0; }
  .fallback { position: absolute; inset: 0; display: grid; place-items: center; color: rgb(var(--c-text-3)); background: linear-gradient(160deg, rgb(var(--c-subtle)), rgb(var(--c-border) / 0.6)); }
</style>
