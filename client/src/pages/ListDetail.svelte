<script lang="ts">
  import { ArrowLeft, GripVertical, X, ListVideo, Search } from '@lucide/svelte';
  import { flip } from 'svelte/animate';
  import { api, type ListItem, type ListSummary } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { router, titleHref } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import { preferredTitle, year, STATUS_LABEL, debounce } from '../lib/format';
  import Filters, { type FilterState } from '../components/Filters.svelte';
  import Poster from '../components/Poster.svelte';
  import Pagination from '../components/Pagination.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let { id }: { id: number } = $props();
  const SORTS = [
    { value: 'position', label: 'My order' },
    { value: 'recently_added', label: 'Date added' },
    { value: 'title', label: 'Title' },
    { value: 'release_date', label: 'Release date' },
    { value: 'rating', label: 'My rating' },
  ];
  let filters = $state<FilterState>({ search: '', sort: 'position', order: 'asc', type: '', genre: '', rating: '', decade: '', status: '', rewatched: false });
  let list = $state<ListSummary | null>(null);
  let items = $state<ListItem[] | null>(null);
  let page = $state(1);
  let pages = $state(1);
  let dragging = $state<number | null>(null);
  let genres = $state<string[]>([]);
  $effect(() => {
    api.library.genres().then((g) => (genres = g.genres)).catch(() => {});
  });

  async function load() {
    try {
      const r = await api.lists.get(id, {
        page,
        search: filters.search,
        sort: filters.sort === 'position' ? '' : filters.sort,
        order: filters.sort === 'position' ? '' : filters.order,
        type: filters.type,
        genre: filters.genre,
        rating: filters.rating,
        decade: filters.decade,
        status: filters.status,
        rewatched: filters.rewatched ? 1 : '',
      });
      list = r.list;
      items = r.items;
      pages = r.pages;
    } catch (e: any) {
      toast.error(e.message);
      if (e.status === 404) router.go('/lists', { replace: true });
    }
  }
  const loadSoon = debounce(load, 250);
  $effect(() => {
    void id;
    load();
  });
  const canDrag = $derived(filters.sort === 'position' && !filters.search && !filters.type && !filters.genre && !filters.rating && !filters.status && pages === 1);

  async function removeItem(it: ListItem) {
    if (!it.media.id) return;
    try {
      await api.lists.removeItem(id, it.media.id);
      items = items?.filter((x) => x.media.id !== it.media.id) ?? null;
      if (list) list = { ...list, item_count: list.item_count - 1 };
      toast.success('Removed from list');
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  function dragStart(i: number) {
    dragging = i;
  }
  function dragOver(e: DragEvent, i: number) {
    e.preventDefault();
    if (dragging === null || dragging === i || !items) return;
    const arr = [...items];
    const [m] = arr.splice(dragging, 1);
    arr.splice(i, 0, m);
    items = arr;
    dragging = i;
  }
  async function dragEnd() {
    dragging = null;
    if (!items) return;
    try {
      await api.lists.reorder(id, items.map((x) => x.media.id!).filter(Boolean));
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function move(i: number, dir: number) {
    if (!items) return;
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const arr = [...items];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    items = arr;
    await api.lists.reorder(id, arr.map((x) => x.media.id!).filter(Boolean)).catch((e) => toast.error(e.message));
  }
</script>

<div class="page">
  <a class="back muted" href="/lists"><ArrowLeft size={16} /> All lists</a>
  {#if list}
    <div class="page-head animate-rise">
      <div><h1>{list.name}</h1><p class="sub">{list.description || `${list.item_count} title${list.item_count === 1 ? '' : 's'}`}</p></div>
    </div>
  {/if}
  <Filters value={filters} onchange={(v) => { const s = v.search !== filters.search; filters = v; page = 1; s ? loadSoon() : load(); }} sorts={SORTS} {genres} showStatus placeholder="Search this list…" />

  {#if items === null}
    <div class="rows">{#each [1, 2, 3, 4] as _}<div class="skeleton sk"></div>{/each}</div>
  {:else if !items.length}
    <EmptyState title="This list is empty" text="Open any title and use “Add to list”, or search for something new.">
      {#snippet icon()}<ListVideo size={26} />{/snippet}
      <a class="btn btn-primary" href="/search"><Search size={16} /> Search</a>
    </EmptyState>
  {:else}
    {#if canDrag}<p class="hint faint">Drag rows to reorder.</p>{/if}
    <div class="rows">
      {#each items as it, i (it.media.id)}
        <div class="row card" class:drag={dragging === i} draggable={canDrag} ondragstart={() => dragStart(i)} ondragover={(e) => dragOver(e, i)} ondragend={dragEnd} role="listitem" animate:flip={{ duration: 220 }}>
          {#if canDrag}
            <div class="grip"><GripVertical size={16} /></div>
          {:else}
            <div class="num faint">{it.position}</div>
          {/if}
          <a class="poster" href={titleHref(it.media)}><Poster path={it.media.poster_path} size="w92" type={it.media.media_type} radius="0.375rem" /></a>
          <div class="body">
            <a class="title truncate" href={titleHref(it.media)}>{preferredTitle(it.media, auth.titleLanguage)}</a>
            <div class="meta faint">{year(it.media.release_date)} · {it.media.media_type === 'tv' ? 'Series' : 'Movie'}{#if it.tracking} · <span class="status-{it.tracking.status} st"><span class="dot"></span>{STATUS_LABEL[it.tracking.status]}</span>{/if}{#if it.tracking?.rating} · ★ {it.tracking.rating / 2}{/if}</div>
          </div>
          {#if canDrag}
            <div class="mv">
              <button class="icon-btn icon-btn-sm" onclick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>↑</button>
              <button class="icon-btn icon-btn-sm" onclick={() => move(i, 1)} aria-label="Move down" disabled={i === items.length - 1}>↓</button>
            </div>
          {/if}
          <button class="icon-btn icon-btn-sm rm" onclick={() => removeItem(it)} aria-label="Remove from list"><X size={16} /></button>
        </div>
      {/each}
    </div>
    <Pagination {page} {pages} onchange={(p) => { page = p; load(); }} />
  {/if}
</div>

<style>
  .back { display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 600; margin-bottom: 0.75rem; }
  .back:hover { color: rgb(var(--c-brand)); }
  .hint { font-size: 0.75rem; margin: -0.5rem 0 0.5rem; }
  .rows { display: flex; flex-direction: column; gap: 0.5rem; }
  .sk { height: 4.5rem; border-radius: var(--radius-lg); }
  .row { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem 0.5rem 0.5rem; transition: box-shadow var(--dur-2), transform var(--dur-2); }
  .row.drag { opacity: 0.6; box-shadow: var(--shadow-lg); }
  .grip { color: rgb(var(--c-text-3)); cursor: grab; }
  .num { width: 1.5rem; text-align: center; font-weight: 700; font-size: 0.8125rem; }
  .poster { width: 2.75rem; flex-shrink: 0; }
  .body { flex: 1; min-width: 0; }
  .title { font-weight: 600; display: block; }
  .title:hover { color: rgb(var(--c-brand)); }
  .meta { font-size: 0.75rem; }
  .st { display: inline-flex; align-items: center; gap: 0.25rem; color: rgb(var(--status)); }
  .mv { display: flex; gap: 0.1rem; }
  .rm { color: rgb(var(--c-text-3)); }
  .rm:hover { color: rgb(var(--c-danger)); }
</style>
