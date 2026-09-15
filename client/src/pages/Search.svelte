<script lang="ts">
  import { Search as SearchIcon, TrendingUp, Plus, Check, Star, Loader2, Tv, Film } from '@lucide/svelte';
  import { api, type SearchResult, type Status } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import { preferredTitle, year, debounce, STATUS_LABEL, STATUS_ORDER } from '../lib/format';
  import Poster from '../components/Poster.svelte';
  import Pagination from '../components/Pagination.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let q = $state(router.query.get('q') || '');
  let type = $state<'' | 'tv' | 'movie'>((router.query.get('type') as any) || '');
  let page = $state(1);
  let results = $state<SearchResult[] | null>(null);
  let pages = $state(1);
  let trending = $state<SearchResult[] | null>(null);
  let loading = $state(false);
  let input = $state<HTMLInputElement>();
  let seq = 0;
  let adding = $state<number | null>(null);
  let menuFor = $state<number | null>(null);

  $effect(() => {
    api.tmdb.trending().then((t) => (trending = t.results)).catch(() => (trending = []));
    input?.focus();
  });
  async function run() {
    const my = ++seq;
    router.setQuery({ q, type });
    if (!q.trim()) {
      results = null;
      return;
    }
    loading = true;
    try {
      const r = await api.tmdb.search(q.trim(), page, type);
      if (my !== seq) return;
      results = r.results;
      pages = r.pages;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      if (my === seq) loading = false;
    }
  }
  const runSoon = debounce(() => {
    page = 1;
    run();
  }, 300);
  $effect(() => {
    if (q) run();
  });

  async function add(r: SearchResult, status: Status) {
    adding = r.tmdb_id;
    menuFor = null;
    try {
      const v = await api.titles.track(r.type, r.tmdb_id, { status });
      r.tracking = v.tracking;
      r.media_id = v.media.id;
      toast.success(`Added to ${STATUS_LABEL[status]}`, { label: 'Open', run: () => router.go(`/title/${r.type}/${r.tmdb_id}`) });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      adding = null;
    }
  }
  const shown = $derived(results ?? (q ? [] : trending) ?? []);
</script>

<div class="page">
  <div class="page-head animate-rise"><div><h1>Search</h1><p class="sub">Movies and series from TMDB. Add anything to your library in one click.</p></div></div>

  <form class="bar card animate-rise" onsubmit={(e) => { e.preventDefault(); page = 1; run(); }}>
    <label class="in">
      <SearchIcon size={18} class="ic" />
      <input class="input" type="search" placeholder="Search titles…" bind:value={q} bind:this={input} oninput={runSoon} />
      {#if loading}<Loader2 size={16} class="spin ld" />{/if}
    </label>
    <div class="seg">
      {#each [['', 'All'], ['tv', 'Series'], ['movie', 'Movies']] as [v, l]}
        <button type="button" class="seg-item" data-active={type === v} onclick={() => { type = v as any; page = 1; run(); }}>{l}</button>
      {/each}
    </div>
  </form>

  {#if !q && trending?.length}
    <div class="section-head"><h2><TrendingUp size={18} /> Trending this week</h2></div>
  {/if}

  {#if q && results && results.length === 0 && !loading}
    <EmptyState title="No results" text={`Nothing on TMDB matches “${q}”.`}>{#snippet icon()}<SearchIcon size={26} />{/snippet}</EmptyState>
  {:else}
    <div class="results">
      {#each shown as r, i (r.type + r.tmdb_id)}
        <div class="res card animate-rise" style:animation-delay="{Math.min(i, 10) * 30}ms">
          <a class="poster" href="/title/{r.type}/{r.tmdb_id}"><Poster path={r.poster_path} size="w185" type={r.type} radius="var(--radius-sm)" /></a>
          <div class="body">
            <a class="title" href="/title/{r.type}/{r.tmdb_id}">{preferredTitle(r, auth.titleLanguage)}</a>
            <div class="meta faint">
              <span class="pill">{#if r.type === 'tv'}<Tv size={11} /> Series{:else}<Film size={11} /> Movie{/if}</span>
              {#if r.release_date}<span>{year(r.release_date)}</span>{/if}
              {#if r.vote_average}<span class="tm"><Star size={11} /> {r.vote_average}</span>{/if}
            </div>
            <p class="ov clamp-3 muted">{r.overview || 'No overview available.'}</p>
            <div class="acts">
              {#if r.tracking}
                <a class="btn btn-sm btn-soft status-{r.tracking.status}" href="/title/{r.type}/{r.tmdb_id}"><Check size={14} /> {STATUS_LABEL[r.tracking.status]}</a>
              {:else}
                <div class="addwrap">
                  <button class="btn btn-sm btn-primary" onclick={() => add(r, 'to_watch')} disabled={adding === r.tmdb_id}>
                    {#if adding === r.tmdb_id}<Loader2 size={14} class="spin" />{:else}<Plus size={14} />{/if} Plan to watch
                  </button>
                  <button class="btn btn-sm btn-secondary" onclick={() => (menuFor = menuFor === r.tmdb_id ? null : r.tmdb_id)} aria-label="More statuses">▾</button>
                  {#if menuFor === r.tmdb_id}
                    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                    <div class="scrim" role="presentation" onclick={() => (menuFor = null)}></div>
                    <div class="menu animate-rise">
                      {#each STATUS_ORDER as s}<button class="mi status-{s}" onclick={() => add(r, s)}><span class="dot"></span>{STATUS_LABEL[s]}</button>{/each}
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
    {#if results}<Pagination {page} {pages} onchange={(p) => { page = p; run(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />{/if}
  {/if}
</div>

<style>
  .bar { display: flex; gap: 0.5rem; padding: 0.625rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .in { position: relative; flex: 1 1 16rem; }
  .in :global(.ic) { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: rgb(var(--c-text-3)); }
  .in :global(.ld) { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); color: rgb(var(--c-brand)); }
  .in .input { padding-left: 2.4rem; height: 2.75rem; font-size: 1rem; }
  .results { display: grid; grid-template-columns: repeat(auto-fill, minmax(21rem, 1fr)); gap: 0.875rem; }
  .res { display: flex; gap: 0.875rem; padding: 0.75rem; transition: transform var(--dur-2) var(--ease-spring), box-shadow var(--dur-2) var(--ease); }
  .res:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .res:has(.menu) { z-index: 30; position: relative; }
  .poster { width: 5.5rem; flex-shrink: 0; }
  .body { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .title { font-weight: 700; font-size: 0.9375rem; }
  .title:hover { color: rgb(var(--c-brand)); }
  .meta { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; margin: 0.25rem 0 0.4rem; }
  .tm { display: inline-flex; align-items: center; gap: 0.2rem; color: rgb(var(--c-signal)); font-weight: 600; }
  .ov { font-size: 0.8125rem; flex: 1; }
  .acts { margin-top: 0.625rem; display: flex; }
  .addwrap { position: relative; display: flex; gap: 0.25rem; }
  .scrim { position: fixed; inset: 0; z-index: 20; }
  .menu { position: absolute; top: calc(100% + 0.3rem); left: 0; z-index: 21; background: rgb(var(--c-raised)); border: 1px solid rgb(var(--c-border)); border-radius: var(--radius-md); box-shadow: var(--shadow-pop); padding: 0.3rem; min-width: 11rem; }
  .mi { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.7rem; border-radius: 0.45rem; font-weight: 600; text-align: left; }
  .mi:hover { background: rgb(var(--c-subtle)); }
</style>
