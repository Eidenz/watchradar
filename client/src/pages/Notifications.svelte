<script lang="ts">
  import { Bell, CheckCheck, Trash2, Sparkles, Tv } from '@lucide/svelte';
  import { api, type Notification } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { toast } from '../lib/toast.svelte';
  import { preferredTitle, relTime } from '../lib/format';
  import { titleHref } from '../lib/router.svelte';
  import Poster from '../components/Poster.svelte';
  import Pagination from '../components/Pagination.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let items = $state<Notification[] | null>(null);
  let page = $state(1);
  let pages = $state(1);
  async function load() {
    try {
      const r = await api.notifications.list(page);
      items = r.items;
      pages = r.pages;
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  $effect(() => {
    load();
  });
  async function readAll() {
    await api.notifications.read();
    items = items?.map((n) => ({ ...n, read: true })) ?? null;
    auth.unread = 0;
  }
  async function open(n: Notification) {
    if (!n.read) {
      api.notifications.read([n.id]).then((r) => (auth.unread = r.unread));
      n.read = true;
    }
  }
  async function remove(n: Notification) {
    await api.notifications.remove(n.id);
    items = items?.filter((x) => x.id !== n.id) ?? null;
    auth.refreshCounts();
  }
  async function clear() {
    await api.notifications.clear();
    items = [];
    auth.unread = 0;
  }
  const text = (n: Notification) =>
    n.type === 'new_season'
      ? `New season${n.payload.seasons?.length > 1 ? 's' : ''} ${n.payload.seasons?.join(', ')} announced`
      : n.type === 'new_episodes'
        ? `${n.payload.count} new episode${n.payload.count === 1 ? '' : 's'} added${n.payload.first ? ` (from S${n.payload.first.season_number}E${n.payload.first.episode_number})` : ''}`
        : n.type;
</script>

<div class="page narrow">
  <div class="page-head animate-rise">
    <div><h1>Notifications</h1><p class="sub">New seasons and episodes for the titles you follow.</p></div>
    <div class="acts">
      <button class="btn btn-secondary btn-sm" onclick={readAll} disabled={!items?.some((n) => !n.read)}><CheckCheck size={14} /> Mark all read</button>
      <button class="btn btn-ghost btn-sm" onclick={clear} disabled={!items?.length}><Trash2 size={14} /> Clear</button>
    </div>
  </div>
  {#if items === null}
    <div class="list">{#each [1, 2, 3] as _}<div class="skeleton sk"></div>{/each}</div>
  {:else if !items.length}
    <EmptyState title="All quiet" text="When a series you track gets a new season or episodes, it shows up here. The radar checks TMDB a few times a day.">{#snippet icon()}<Bell size={26} />{/snippet}</EmptyState>
  {:else}
    <div class="list">
      {#each items as n, i (n.id)}
        <div class="n card animate-rise" class:unread={!n.read} style:animation-delay="{Math.min(i, 10) * 25}ms">
          {#if n.media}<a class="poster" href={titleHref(n.media as any)} onclick={() => open(n)}><Poster path={n.media.poster_path} size="w92" type={n.media.media_type} radius="0.375rem" /></a>{/if}
          <div class="body">
            <a class="t" href={n.media ? titleHref(n.media as any) : '#'} onclick={() => open(n)}>{n.media ? preferredTitle(n.media, auth.titleLanguage) : 'WatchRadar'}</a>
            <div class="msg"><span class="ic">{#if n.type === 'new_season'}<Sparkles size={12} />{:else}<Tv size={12} />{/if}</span>{text(n)}</div>
            <div class="faint time">{relTime(n.created_at)}</div>
          </div>
          <button class="icon-btn icon-btn-sm" onclick={() => remove(n)} aria-label="Dismiss"><Trash2 size={14} /></button>
        </div>
      {/each}
    </div>
    <Pagination {page} {pages} onchange={(p) => { page = p; load(); }} />
  {/if}
</div>

<style>
  .narrow { max-width: 46rem; }
  .acts { display: flex; gap: 0.35rem; }
  .list { display: flex; flex-direction: column; gap: 0.5rem; }
  .sk { height: 4.5rem; border-radius: var(--radius-lg); }
  .n { display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 0.75rem; position: relative; }
  .n.unread { border-color: rgb(var(--c-brand) / 0.5); }
  .n.unread::before { content: ''; position: absolute; left: -1px; top: 0.75rem; bottom: 0.75rem; width: 3px; border-radius: 999px; background: rgb(var(--c-brand)); }
  .poster { width: 2.5rem; flex-shrink: 0; }
  .body { flex: 1; min-width: 0; }
  .t { font-weight: 700; }
  .t:hover { color: rgb(var(--c-brand)); }
  .msg { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; }
  .ic { width: 1.1rem; height: 1.1rem; border-radius: 999px; background: rgb(var(--c-brand) / 0.15); color: rgb(var(--c-brand)); display: grid; place-items: center; }
  .time { font-size: 0.75rem; }
</style>
