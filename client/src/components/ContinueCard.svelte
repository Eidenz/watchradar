<script lang="ts">
  // Home "continue watching" card: backdrop, next episode, quick mark-watched.
  import { Check, Play, Repeat, Loader2 } from '@lucide/svelte';
  import { fade } from 'svelte/transition';
  import { api, type LibraryItem } from '../lib/api';
  import { preferredTitle, img } from '../lib/format';
  import { auth } from '../lib/auth.svelte';
  import { titleHref } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import ProgressBar from './ProgressBar.svelte';

  let { item, onchange }: { item: LibraryItem; onchange?: (v: LibraryItem | null) => void } = $props();
  let busy = $state(false);
  const title = $derived(preferredTitle(item.media, auth.titleLanguage));
  const p = $derived(item.progress ?? null);
  const backdrop = $derived(img(item.media.backdrop_path, 'w780') || img(item.media.poster_path, 'w500'));

  async function markNext() {
    if (!item.media.id) return;
    busy = true;
    try {
      if (item.media.media_type === 'tv' && p?.next_episode) {
        const v = await api.media.episode(item.media.id, p.next_episode.season_number, p.next_episode.episode_number, true);
        if (v.completed) toast.success(`${title} completed!`);
        onchange?.(v.tracking?.status === 'watching' ? { media: v.media, tracking: v.tracking!, progress: v.progress } : null);
      } else {
        const v = await api.media.status(item.media.id, 'watched');
        toast.success(`${title} marked as watched`);
        onchange?.(null);
        void v;
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      busy = false;
    }
  }
</script>

<article class="cc" in:fade={{ duration: 200 }}>
  <a class="hero" href={titleHref(item.media)} style:background-image={backdrop ? `url(${backdrop})` : undefined}>
    <div class="shade"></div>
    {#if item.tracking.is_rewatching}<span class="pill pill-signal tag"><Repeat size={11} /> Rewatch #{item.tracking.active_run}</span>{/if}
    <div class="hero-text">
      <div class="t truncate">{title}</div>
      {#if p?.season}
        <div class="s">{p.season.name}{p.season.part_label ? ` · ${p.season.part_label}` : ''} · {p.season.watched}/{p.season.aired} watched</div>
      {:else if item.media.media_type === 'movie'}
        <div class="s">Movie{item.media.runtime ? ` · ${item.media.runtime} min` : ''}</div>
      {/if}
    </div>
  </a>
  {#if p?.season}
    <div class="bar"><ProgressBar value={p.season.aired ? (p.season.watched / p.season.aired) * 100 : 0} height={4} /></div>
  {/if}
  <div class="next">
    {#if p?.next_episode}
      <div class="ep">
        <span class="code">{p.next_episode.code}{p.next_episode.display_number !== p.next_episode.episode_number ? ` (${p.season?.part_label} · ${p.next_episode.display_number})` : ''}</span>
        <span class="name truncate">{p.next_episode.title || 'Untitled'}</span>
      </div>
    {:else if item.media.media_type === 'movie'}
      <div class="ep"><span class="name">Finished it?</span></div>
    {/if}
    <button class="btn btn-primary btn-sm" onclick={markNext} disabled={busy}>
      {#if busy}<Loader2 size={15} class="spin" />{:else if item.media.media_type === 'movie'}<Check size={15} />{:else}<Play size={15} />{/if}
      {item.media.media_type === 'movie' ? 'Watched' : 'Watched it'}
    </button>
  </div>
</article>

<style>
  .cc { width: 19rem; background: rgb(var(--c-surface)); border: 1px solid rgb(var(--c-border)); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); transition: transform var(--dur-3) var(--ease-spring), box-shadow var(--dur-3) var(--ease); }
  .cc:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
  .hero { position: relative; display: block; aspect-ratio: 16 / 8; background: rgb(var(--c-subtle)) center / cover no-repeat; }
  .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(0 0 0 / 0.05) 20%, rgb(0 0 0 / 0.75)); }
  .tag { position: absolute; top: 0.6rem; left: 0.6rem; }
  .hero-text { position: absolute; left: 0.875rem; right: 0.875rem; bottom: 0.7rem; color: #fff; }
  .t { font-weight: 700; font-size: 1rem; text-shadow: 0 1px 8px rgb(0 0 0 / 0.5); }
  .s { font-size: 0.75rem; opacity: 0.85; }
  .bar { padding: 0 0.875rem; margin-top: -2px; position: relative; z-index: 1; }
  .next { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.75rem 0.875rem; }
  .ep { display: flex; flex-direction: column; min-width: 0; }
  .code { font-size: 0.6875rem; font-weight: 700; color: rgb(var(--c-brand)); letter-spacing: 0.04em; }
  .name { font-weight: 600; font-size: 0.8125rem; }
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
