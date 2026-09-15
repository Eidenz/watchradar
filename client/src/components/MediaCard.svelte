<script lang="ts">
  // Poster card used in grids. Shows status dot, rating, rewatch badge and (optionally) progress.
  import { Star, Repeat, Lock, Sparkles } from '@lucide/svelte';
  import Poster from './Poster.svelte';
  import type { Media, MediaLite, Progress, Tracking } from '../lib/api';
  import { preferredTitle, year, STATUS_LABEL } from '../lib/format';
  import { auth } from '../lib/auth.svelte';
  import { titleHref } from '../lib/router.svelte';

  interface Props {
    media: MediaLite & Partial<Media>;
    tracking?: Partial<Tracking> | null;
    progress?: Progress | null;
    subtitle?: string;
    showStatus?: boolean;
    delay?: number;
  }
  let { media, tracking = null, progress = null, subtitle, showStatus = true, delay = 0 }: Props = $props();
  const title = $derived(preferredTitle(media, auth.titleLanguage));
</script>

<a class="card-media animate-rise" href={titleHref(media)} style:animation-delay="{delay}ms">
  <div class="art">
    <Poster path={media.poster_path} alt={title} type={media.media_type} radius="var(--radius-md)" />
    <div class="overlay">
      {#if tracking?.rating}<span class="pill pill-dark"><Star size={11} class="star" />{tracking.rating / 2}</span>{/if}
      {#if tracking?.watch_count && tracking.watch_count > 1}<span class="pill pill-dark" title="Watched {tracking.watch_count} times"><Repeat size={11} />{tracking.watch_count}</span>{/if}
      {#if tracking?.is_private}<span class="pill pill-dark"><Lock size={11} /></span>{/if}
    </div>
    {#if progress && progress.unwatched_aired > 0 && tracking?.status === 'watched'}
      <span class="pill pill-signal newpill"><Sparkles size={11} /> {progress.unwatched_aired} new</span>
    {/if}
    {#if progress && progress.aired > 0 && tracking?.status !== 'watched'}
      <div class="prog"><div style:width="{progress.percent}%"></div></div>
    {/if}
  </div>
  <div class="meta">
    <div class="title truncate" {title}>{title}</div>
    <div class="sub faint">
      {#if showStatus && tracking?.status}<span class="dot status-{tracking.status}" title={STATUS_LABEL[tracking.status]}></span>{/if}
      <span class="truncate">{subtitle ?? [year(media.release_date), media.media_type === 'tv' ? 'Series' : 'Movie'].filter(Boolean).join(' · ')}</span>
    </div>
  </div>
</a>

<style>
  .card-media { display: block; min-width: 0; }
  .art { position: relative; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); transition: transform var(--dur-3) var(--ease-spring), box-shadow var(--dur-3) var(--ease); }
  .card-media:hover .art { transform: translateY(-4px) scale(1.02); box-shadow: var(--shadow-lg); }
  .overlay { position: absolute; top: 0.4rem; left: 0.4rem; right: 0.4rem; display: flex; gap: 0.25rem; flex-wrap: wrap; }
  .overlay .pill { padding: 0.1rem 0.45rem; font-size: 0.6875rem; }
  .overlay :global(.star) { color: rgb(var(--c-signal)); fill: currentColor; }
  .newpill { position: absolute; bottom: 0.45rem; left: 0.4rem; font-size: 0.6875rem; }
  .prog { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: rgb(0 0 0 / 0.35); border-radius: 0 0 var(--radius-md) var(--radius-md); overflow: hidden; }
  .prog div { height: 100%; background: rgb(var(--c-brand)); }
  .meta { padding: 0.5rem 0.125rem 0; }
  .title { font-weight: 600; font-size: 0.8125rem; }
  .sub { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; margin-top: 0.1rem; }
</style>
