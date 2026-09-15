<script lang="ts">
  // Search + sort + filter drawer shared by the library, list detail and public library pages.
  import { Search, SlidersHorizontal, ArrowDownAZ, ArrowUpAZ, X } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import type { Status } from '../lib/api';
  import { STATUS_LABEL, STATUS_ORDER } from '../lib/format';

  export interface FilterState {
    search: string;
    sort: string;
    order: 'asc' | 'desc';
    type: '' | 'tv' | 'movie';
    genre: string;
    rating: string;
    decade: string;
    status: '' | Status;
    rewatched: boolean;
  }
  interface Props {
    value: FilterState;
    onchange: (v: FilterState) => void;
    sorts: { value: string; label: string }[];
    genres?: string[];
    showStatus?: boolean;
    placeholder?: string;
  }
  let { value, onchange, sorts, genres = [], showStatus = false, placeholder = 'Search your library…' }: Props = $props();
  let open = $state(false);
  const set = (patch: Partial<FilterState>) => onchange({ ...value, ...patch });
  const active = $derived([value.type, value.genre, value.rating, value.decade, value.status, value.rewatched ? '1' : ''].filter(Boolean).length);
  const decades = Array.from({ length: 10 }, (_, i) => 2020 - i * 10);
</script>

<div class="filters card">
  <div class="row">
    <label class="search">
      <Search size={17} class="ic" />
      <input class="input" type="search" {placeholder} value={value.search} oninput={(e) => set({ search: (e.target as HTMLInputElement).value })} />
    </label>
    <div class="sorts">
      <select class="select" value={value.sort} onchange={(e) => set({ sort: (e.target as HTMLSelectElement).value })}>
        {#each sorts as s}<option value={s.value}>{s.label}</option>{/each}
      </select>
      <button class="icon-btn icon-btn-solid" title="Toggle order" onclick={() => set({ order: value.order === 'asc' ? 'desc' : 'asc' })}>
        {#if value.order === 'asc'}<ArrowUpAZ size={18} />{:else}<ArrowDownAZ size={18} />{/if}
      </button>
      <button class="icon-btn icon-btn-solid" class:on={open || active > 0} title="Filters" onclick={() => (open = !open)}>
        <SlidersHorizontal size={18} />
        {#if active}<span class="cnt">{active}</span>{/if}
      </button>
    </div>
  </div>
  {#if open}
    <div class="drawer" transition:slide={{ duration: 200 }}>
      <div class="grp">
        <span class="lbl">Type</span>
        {#each [['', 'All'], ['tv', 'Series'], ['movie', 'Movies']] as [v, l]}
          <button class="chip" data-active={value.type === v} onclick={() => set({ type: v as any })}>{l}</button>
        {/each}
      </div>
      {#if showStatus}
        <div class="grp">
          <span class="lbl">Status</span>
          <button class="chip" data-active={value.status === ''} onclick={() => set({ status: '' })}>Any</button>
          {#each STATUS_ORDER as s}<button class="chip" data-active={value.status === s} onclick={() => set({ status: s })}>{STATUS_LABEL[s]}</button>{/each}
        </div>
      {/if}
      <div class="grp">
        <span class="lbl">Rating</span>
        {#each [['', 'Any'], ['9', '4.5+'], ['8', '4+'], ['6', '3+'], ['4', '2+'], ['unrated', 'Unrated']] as [v, l]}
          <button class="chip" data-active={value.rating === v} onclick={() => set({ rating: v })}>{l}</button>
        {/each}
        <button class="chip" data-active={value.rewatched} onclick={() => set({ rewatched: !value.rewatched })}>Rewatched</button>
      </div>
      {#if genres.length}
        <div class="grp">
          <span class="lbl">Genre</span>
          <select class="select small" value={value.genre} onchange={(e) => set({ genre: (e.target as HTMLSelectElement).value })}>
            <option value="">Any genre</option>
            {#each genres as g}<option value={g}>{g}</option>{/each}
          </select>
          <select class="select small" value={value.decade} onchange={(e) => set({ decade: (e.target as HTMLSelectElement).value })}>
            <option value="">Any decade</option>
            {#each decades as d}<option value={String(d)}>{d}s</option>{/each}
          </select>
          {#if active}<button class="btn btn-ghost btn-sm" onclick={() => set({ type: '', genre: '', rating: '', decade: '', status: '', rewatched: false })}><X size={14} /> Clear</button>{/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filters { padding: 0.625rem; margin-bottom: 1.25rem; }
  .row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .search { position: relative; flex: 1 1 14rem; display: block; }
  .search :global(.ic) { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: rgb(var(--c-text-3)); pointer-events: none; }
  .search .input { padding-left: 2.35rem; }
  .sorts { display: flex; gap: 0.5rem; }
  .sorts .select { width: auto; min-width: 9rem; }
  .sorts .icon-btn { width: 2.5rem; height: 2.5rem; }
  .on { color: rgb(var(--c-brand)); border-color: rgb(var(--c-brand) / 0.5); }
  .cnt { position: absolute; top: -0.3rem; right: -0.3rem; min-width: 1rem; height: 1rem; border-radius: 999px; background: rgb(var(--c-brand)); color: rgb(var(--c-on-brand)); font-size: 0.625rem; font-weight: 700; display: grid; place-items: center; padding: 0 0.25rem; }
  .drawer { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem 0.25rem 0.25rem; }
  .grp { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
  .lbl { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgb(var(--c-text-3)); width: 3.5rem; }
  .small { width: auto; height: 2rem; font-size: 0.8125rem; }
</style>
