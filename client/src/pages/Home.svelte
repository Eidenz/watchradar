<script lang="ts">
  import { Play, Sparkles, CalendarClock, Bookmark, CheckCheck, Radar, Clock, Tv, Film, ListVideo, Search } from '@lucide/svelte';
  import { api, type HomeData, type LibraryItem } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { toast } from '../lib/toast.svelte';
  import { preferredTitle, airsIn, img } from '../lib/format';
  import { titleHref } from '../lib/router.svelte';
  import ContinueCard from '../components/ContinueCard.svelte';
  import MediaCard from '../components/MediaCard.svelte';
  import Rail from '../components/Rail.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let data = $state<HomeData | null>(null);
  let error = $state('');
  async function load() {
    try {
      data = await api.library.home();
    } catch (e: any) {
      error = e.message;
      toast.error(e.message);
    }
  }
  $effect(() => {
    load();
  });

  function replaceItem(list: LibraryItem[], id: number | null, next: LibraryItem | null) {
    const i = list.findIndex((x) => x.media.id === id);
    if (i < 0) return list;
    const out = [...list];
    if (next) out[i] = next;
    else out.splice(i, 1);
    return out;
  }
  const greeting = $derived.by(() => {
    const h = new Date().getHours();
    return h < 5 ? 'Late night session' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });
  const empty = $derived(data && !data.continue_watching.length && !data.new_episodes.length && !data.planned.length && !data.recently_completed.length && !data.upcoming.length);
</script>

<div class="page">
  <div class="page-head animate-rise">
    <div>
      <h1>{greeting}, {auth.user?.username}</h1>
      {#if data}
        <p class="sub">
          <a class="stat" href="/library/watching"><Play size={14} /> {data.counts.watching} watching</a>
          <a class="stat" href="/library/to_watch"><Bookmark size={14} /> {data.counts.to_watch} planned</a>
          <a class="stat" href="/library/watched"><CheckCheck size={14} /> {data.counts.watched} completed</a>
        </p>
      {/if}
    </div>
    <a class="btn btn-primary" href="/search"><Search size={16} /> Add a title</a>
  </div>

  {#if !data && !error}
    <div class="sk-rail">{#each [1, 2, 3] as _}<div class="skeleton sk"></div>{/each}</div>
  {:else if data}
    {#if data.aired_today.length}
      <div class="today card animate-rise">
        <Radar size={18} class="pulse" />
        <div>
          <strong>Airing today</strong>
          <span class="muted">
            {#each data.aired_today as ep, i}{i > 0 ? ', ' : ''}<a class="link" href="/title/{ep.media_type}/{ep.tmdb_id}">{preferredTitle(ep as any, auth.titleLanguage)} S{ep.season_number}E{ep.episode_number}</a>{/each}
          </span>
        </div>
      </div>
    {/if}

    {#if data.continue_watching.length}
      <Rail title="Continue watching" href="/library/watching" count={data.continue_watching.length}>
        {#snippet icon()}<Play size={18} />{/snippet}
        {#each data.continue_watching as item (item.media.id)}
          <ContinueCard {item} onchange={(next) => (data = data && { ...data, continue_watching: replaceItem(data.continue_watching, item.media.id, next) })} />
        {/each}
      </Rail>
    {/if}

    {#if data.new_episodes.length}
      <Rail title="New episodes for you" count={data.new_episodes.length}>
        {#snippet icon()}<Sparkles size={18} class="signal" />{/snippet}
        {#each data.new_episodes as item, i (item.media.id)}
          <div class="poster-slot"><MediaCard media={item.media} tracking={item.tracking} progress={item.progress} delay={i * 30} subtitle="{item.progress?.unwatched_aired} new episode{item.progress?.unwatched_aired === 1 ? '' : 's'}" /></div>
        {/each}
      </Rail>
    {/if}

    {#if data.upcoming.length}
      <section class="upcoming">
        <div class="section-head"><h2><CalendarClock size={18} /> Coming up</h2></div>
        <div class="up-list">
          {#each data.upcoming.slice(0, 8) as ep, i (ep.media_id + ':' + ep.season_number + ':' + ep.episode_number)}
            <a class="up card animate-rise" href="/title/{ep.media_type}/{ep.tmdb_id}" style:animation-delay="{i * 30}ms">
              <div class="thumb" style:background-image={img(ep.poster_path, 'w92') ? `url(${img(ep.poster_path, 'w92')})` : undefined}></div>
              <div class="up-text">
                <div class="truncate"><strong>{preferredTitle(ep as any, auth.titleLanguage)}</strong></div>
                <div class="faint truncate">S{ep.season_number}E{ep.episode_number}{ep.episode_title ? ` · ${ep.episode_title}` : ''}</div>
              </div>
              <span class="pill pill-brand"><Clock size={11} /> {airsIn(ep.air_date)}</span>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    {#if data.caught_up.length}
      <Rail title="Caught up — waiting for new episodes" count={data.caught_up.length}>
        {#snippet icon()}<Tv size={18} />{/snippet}
        {#each data.caught_up as item, i (item.media.id)}
          <div class="poster-slot"><MediaCard media={item.media} tracking={item.tracking} delay={i * 30} subtitle={item.progress?.upcoming?.air_date ? `Next ${airsIn(item.progress.upcoming.air_date)}` : 'No date yet'} /></div>
        {/each}
      </Rail>
    {/if}

    {#if data.planned.length}
      <Rail title="Plan to watch" href="/library/to_watch" count={data.counts.to_watch}>
        {#snippet icon()}<Bookmark size={18} />{/snippet}
        {#each data.planned as item, i (item.media.id)}<div class="poster-slot"><MediaCard media={item.media} tracking={item.tracking} delay={i * 30} /></div>{/each}
      </Rail>
    {/if}

    {#if data.recently_completed.length}
      <Rail title="Recently completed" href="/library/watched" count={data.counts.watched}>
        {#snippet icon()}<CheckCheck size={18} />{/snippet}
        {#each data.recently_completed as item, i (item.media.id)}<div class="poster-slot"><MediaCard media={item.media} tracking={item.tracking} delay={i * 30} /></div>{/each}
      </Rail>
    {/if}

    {#if empty}
      <EmptyState title="Your radar is empty" text="Search for a movie or series to start tracking. You can also import a MyAnimeList or Watcharr export from Settings.">
        {#snippet icon()}<Radar size={26} />{/snippet}
        <a class="btn btn-primary" href="/search"><Search size={16} /> Search titles</a>
        <a class="btn btn-secondary" href="/settings/data"><ListVideo size={16} /> Import</a>
      </EmptyState>
    {/if}
  {/if}
</div>

<style>
  .sub { display: flex; gap: 0.875rem; flex-wrap: wrap; }
  .stat { display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 600; }
  .stat:hover { color: rgb(var(--c-brand)); }
  .sk-rail { display: flex; gap: 0.875rem; overflow: hidden; }
  .sk { width: 19rem; height: 13rem; flex-shrink: 0; border-radius: var(--radius-lg); }
  .today { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; margin-bottom: 1.25rem; border-color: rgb(var(--c-brand) / 0.4); }
  .today :global(.pulse) { color: rgb(var(--c-brand)); animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.4; } }
  .today strong { display: block; }
  :global(.signal) { color: rgb(var(--c-signal)); }
  .poster-slot { width: 9.5rem; }
  .upcoming { margin-bottom: 1.75rem; }
  .up-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: 0.625rem; }
  .up { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem 0.5rem 0.5rem; transition: transform var(--dur-2) var(--ease-spring), box-shadow var(--dur-2) var(--ease); }
  .up:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .thumb { width: 2.25rem; aspect-ratio: 2/3; border-radius: 0.375rem; background: rgb(var(--c-subtle)) center / cover; flex-shrink: 0; }
  .up-text { flex: 1; min-width: 0; font-size: 0.8125rem; }
</style>
