<script lang="ts">
  import { Library as LibIcon, Search } from '@lucide/svelte';
  import { api, type LibraryItem, type Counts, type Status } from '../lib/api';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import { STATUS_LABEL, STATUS_ORDER, debounce } from '../lib/format';
  import Filters, { type FilterState } from '../components/Filters.svelte';
  import MediaCard from '../components/MediaCard.svelte';
  import Pagination from '../components/Pagination.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let { status }: { status: string } = $props();

  const SORTS = [
    { value: 'recently_updated', label: 'Recently updated' },
    { value: 'recently_added', label: 'Recently added' },
    { value: 'title', label: 'Title' },
    { value: 'release_date', label: 'Release date' },
    { value: 'rating', label: 'My rating' },
    { value: 'tmdb_rating', label: 'TMDB rating' },
    { value: 'watch_count', label: 'Times watched' },
    { value: 'runtime', label: 'Runtime' },
  ];

  function fromQuery(): FilterState {
    const q = router.query;
    return {
      search: q.get('q') || '',
      sort: q.get('sort') || 'recently_updated',
      order: (q.get('order') as 'asc' | 'desc') || 'desc',
      type: (q.get('type') as any) || '',
      genre: q.get('genre') || '',
      rating: q.get('rating') || '',
      decade: q.get('decade') || '',
      status: '',
      rewatched: q.get('rewatched') === '1',
    };
  }
  let filters = $state<FilterState>(fromQuery());
  let page = $state(Number(router.query.get('page')) || 1);
  let items = $state<LibraryItem[] | null>(null);
  let pages = $state(1);
  let total = $state(0);
  let counts = $state<Counts | null>(null);
  let genres = $state<string[]>([]);
  let loading = $state(false);
  let seq = 0;

  $effect(() => {
    api.library.genres().then((g) => (genres = g.genres)).catch(() => {});
  });

  async function load() {
    const my = ++seq;
    loading = true;
    try {
      const r = await api.library.list({
        status: status === 'all' ? '' : status,
        search: filters.search,
        sort: filters.sort,
        order: filters.order,
        type: filters.type,
        genre: filters.genre,
        rating: filters.rating,
        decade: filters.decade,
        rewatched: filters.rewatched ? 1 : '',
        page,
      });
      if (my !== seq) return;
      items = r.items;
      pages = r.pages;
      total = r.total;
      counts = r.counts;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      if (my === seq) loading = false;
    }
  }
  const loadSoon = debounce(load, 250);

  $effect(() => {
    // React to route status changes.
    void status;
    page = 1;
    load();
  });

  function onFilters(v: FilterState) {
    const searchChanged = v.search !== filters.search;
    filters = v;
    page = 1;
    router.setQuery({ q: v.search, sort: v.sort, order: v.order, type: v.type, genre: v.genre, rating: v.rating, decade: v.decade, rewatched: v.rewatched ? 1 : '', page: '' });
    if (searchChanged) loadSoon();
    else load();
  }
  function goPage(p: number) {
    page = p;
    router.setQuery({ page: p > 1 ? p : '' });
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const tabs = $derived([{ key: 'all', label: 'All' }, ...STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABEL[s as Status] }))]);
</script>

<div class="page">
  <div class="page-head animate-rise">
    <div><h1>Library</h1><p class="sub">{total} title{total === 1 ? '' : 's'}{status !== 'all' ? ` · ${STATUS_LABEL[status as Status]}` : ''}</p></div>
  </div>

  <div class="tabs animate-rise">
    {#each tabs as t}
      <a class="tab status-{t.key}" data-active={status === t.key} href={t.key === 'all' ? '/library' : `/library/${t.key}`}>
        {#if t.key !== 'all'}<span class="dot"></span>{/if}{t.label}
        {#if counts}<span class="n">{t.key === 'all' ? counts.all : counts[t.key as Status]}</span>{/if}
      </a>
    {/each}
  </div>

  <Filters value={filters} onchange={onFilters} sorts={SORTS} {genres} />

  {#if items === null}
    <div class="grid-posters">{#each Array(12) as _}<div class="skeleton sk"></div>{/each}</div>
  {:else if items.length === 0}
    <EmptyState title={filters.search || filters.type || filters.genre || filters.rating ? 'No matches' : 'Nothing here yet'} text={filters.search ? `Nothing in your library matches “${filters.search}”.` : 'Titles you track with this status will show up here.'}>
      {#snippet icon()}<LibIcon size={26} />{/snippet}
      <a class="btn btn-primary" href="/search"><Search size={16} /> Find something to watch</a>
    </EmptyState>
  {:else}
    <div class="grid-posters" class:loading>
      {#each items as it, i (it.media.id)}
        <MediaCard media={it.media} tracking={it.tracking} progress={it.progress} delay={Math.min(i, 12) * 25} showStatus={status === 'all'} />
      {/each}
    </div>
    <Pagination {page} {pages} onchange={goPage} />
  {/if}
</div>

<style>
  .tabs { display: flex; gap: 0.25rem; overflow-x: auto; margin-bottom: 1rem; padding-bottom: 0.25rem; scrollbar-width: none; }
  .tabs::-webkit-scrollbar { display: none; }
  .tab { display: inline-flex; align-items: center; gap: 0.4rem; height: 2.25rem; padding: 0 0.875rem; border-radius: 999px; font-weight: 600; color: rgb(var(--c-text-2)); white-space: nowrap; transition: all var(--dur-2) var(--ease); }
  .tab:hover { background: rgb(var(--c-subtle)); color: rgb(var(--c-text-1)); }
  .tab[data-active='true'] { background: rgb(var(--status, var(--c-text-1)) / 0.12); color: rgb(var(--status, var(--c-text-1))); }
  .status-all { --status: var(--c-text-1); }
  .n { font-size: 0.6875rem; background: rgb(var(--c-surface)); border: 1px solid rgb(var(--c-border)); padding: 0 0.4rem; border-radius: 999px; color: rgb(var(--c-text-3)); }
  .sk { aspect-ratio: 2 / 3.55; }
  .loading { opacity: 0.6; transition: opacity var(--dur-2); }
</style>
