<script lang="ts">
  import { Activity as ActivityIcon, Users } from '@lucide/svelte';
  import { api, type Activity } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import Pagination from '../components/Pagination.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import ActivityItem from '../components/ActivityItem.svelte';

  let scope = $state<'friends' | 'me' | 'all'>('friends');
  let items = $state<Activity[] | null>(null);
  let page = $state(1);
  let pages = $state(1);

  async function load() {
    try {
      const r = await api.social.feed(page, scope);
      items = r.items;
      pages = r.pages;
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  $effect(() => {
    void scope;
    load();
  });
</script>

<div class="page narrow">
  <div class="page-head animate-rise">
    <div><h1>Feed</h1><p class="sub">What your friends have been watching.</p></div>
    <div class="seg">
      {#each [['friends', 'Friends'], ['all', 'Everyone'], ['me', 'Just me']] as [v, l]}
        <button class="seg-item" data-active={scope === v} onclick={() => { scope = v as any; page = 1; }}>{l}</button>
      {/each}
    </div>
  </div>
  {#if items === null}
    <div class="list">{#each [1, 2, 3, 4, 5] as _}<div class="skeleton sk"></div>{/each}</div>
  {:else if !items.length}
    <EmptyState title="Quiet in here" text={scope === 'friends' ? 'Add some friends to see what they are watching.' : 'No activity yet.'}>
      {#snippet icon()}<ActivityIcon size={26} />{/snippet}
      {#if scope === 'friends'}<a class="btn btn-primary" href="/friends"><Users size={16} /> Find friends</a>{/if}
    </EmptyState>
  {:else}
    <div class="list">
      {#each items as a, i (a.id)}<ActivityItem activity={a} delay={Math.min(i, 12) * 25} />{/each}
    </div>
    <Pagination {page} {pages} onchange={(p) => { page = p; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
  {/if}
</div>

<style>
  .narrow { max-width: 46rem; }
  .list { display: flex; flex-direction: column; gap: 0.5rem; }
  .sk { height: 4.25rem; border-radius: var(--radius-lg); }
</style>
