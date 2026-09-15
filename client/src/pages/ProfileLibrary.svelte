<script lang="ts">
  import { ArrowLeft, Library, Lock } from '@lucide/svelte';
  import { api, type LibraryItem } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { debounce } from '../lib/format';
  import Filters, { type FilterState } from '../components/Filters.svelte';
  import MediaCard from '../components/MediaCard.svelte';
  import Pagination from '../components/Pagination.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let { username }: { username: string } = $props();
  const SORTS = [
    { value: 'recently_updated', label: 'Recently updated' },
    { value: 'title', label: 'Title' },
    { value: 'release_date', label: 'Release date' },
    { value: 'rating', label: 'Their rating' },
    { value: 'watch_count', label: 'Times watched' },
  ];
  let filters = $state<FilterState>({ search: '', sort: 'recently_updated', order: 'desc', type: '', genre: '', rating: '', decade: '', status: '', rewatched: false });
  let items = $state<LibraryItem[] | null>(null);
  let page = $state(1);
  let pages = $state(1);
  let total = $state(0);
  let denied = $state('');
  let genres = $state<string[]>([]);
  $effect(() => {
    api.library.genres().then((g) => (genres = g.genres)).catch(() => {});
  });
  async function load() {
    try {
      const r = await api.social.profileLibrary(username, { page, search: filters.search, sort: filters.sort, order: filters.order, type: filters.type, genre: filters.genre, rating: filters.rating, decade: filters.decade, status: filters.status, rewatched: filters.rewatched ? 1 : '' });
      items = r.items;
      pages = r.pages;
      total = r.total;
    } catch (e: any) {
      if (e.status === 403 || e.status === 404) denied = e.message;
      else toast.error(e.message);
    }
  }
  const loadSoon = debounce(load, 250);
  $effect(() => {
    void username;
    load();
  });
</script>

<div class="page">
  <a class="back muted" href="/u/{encodeURIComponent(username)}"><ArrowLeft size={16} /> {username}</a>
  <div class="page-head animate-rise"><div><h1>{username}’s library</h1><p class="sub">{total} title{total === 1 ? '' : 's'}{filters.status ? '' : ' completed'}</p></div></div>
  {#if denied}
    <EmptyState title={denied}>{#snippet icon()}<Lock size={26} />{/snippet}</EmptyState>
  {:else}
    <Filters value={filters} onchange={(v) => { const s = v.search !== filters.search; filters = v; page = 1; s ? loadSoon() : load(); }} sorts={SORTS} {genres} showStatus placeholder="Search their library…" />
    {#if items === null}
      <div class="grid-posters">{#each Array(12) as _}<div class="skeleton sk"></div>{/each}</div>
    {:else if !items.length}
      <EmptyState title="Nothing to show">{#snippet icon()}<Library size={26} />{/snippet}</EmptyState>
    {:else}
      <div class="grid-posters">{#each items as it, i (it.media.id)}<MediaCard media={it.media} tracking={it.tracking} delay={Math.min(i, 12) * 25} showStatus={!!filters.status} />{/each}</div>
      <Pagination {page} {pages} onchange={(p) => { page = p; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
    {/if}
  {/if}
</div>

<style>
  .back { display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 600; margin-bottom: 0.75rem; }
  .back:hover { color: rgb(var(--c-brand)); }
  .sk { aspect-ratio: 2 / 3.55; }
</style>
