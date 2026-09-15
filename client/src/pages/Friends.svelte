<script lang="ts">
  import { Users, UserPlus, Check, X, Search, Loader2, UserMinus, Clock } from '@lucide/svelte';
  import { api, type FriendsData, type Friendship } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { toast } from '../lib/toast.svelte';
  import { confirm } from '../lib/confirm.svelte';
  import { debounce, relTime } from '../lib/format';
  import Avatar from '../components/Avatar.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let data = $state<FriendsData | null>(null);
  let q = $state('');
  let found = $state<{ id: number; username: string; friendship: Friendship }[]>([]);
  let searching = $state(false);

  async function load() {
    try {
      data = await api.social.friends();
      auth.refreshCounts();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  $effect(() => {
    load();
  });
  const search = debounce(async () => {
    if (q.trim().length < 2) return (found = []);
    searching = true;
    try {
      found = (await api.social.searchUsers(q.trim())).users;
    } finally {
      searching = false;
    }
  }, 250);
  async function act(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      await load();
      if (q) search();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function unfriend(id: number, name: string) {
    if (await confirm.ask({ title: `Remove ${name}?`, message: 'You will stop seeing each other’s activity.', confirmLabel: 'Remove', danger: true })) act(() => api.social.remove(id), 'Friend removed');
  }
</script>

<div class="page narrow">
  <div class="page-head animate-rise"><div><h1>Friends</h1><p class="sub">Share what you watch with people you trust.</p></div></div>

  <div class="card find animate-rise">
    <label class="in"><Search size={17} class="ic" /><input class="input" placeholder="Find people by username…" bind:value={q} oninput={search} />{#if searching}<Loader2 size={16} class="spin ld" />{/if}</label>
    {#if found.length}
      <div class="rows">
        {#each found as u (u.id)}
          <div class="row">
            <a href="/u/{encodeURIComponent(u.username)}" class="who"><Avatar name={u.username} size={34} /><span>{u.username}</span></a>
            {#if u.friendship === 'none'}<button class="btn btn-sm btn-primary" onclick={() => act(() => api.social.request(u.id), 'Request sent')}><UserPlus size={14} /> Add</button>
            {:else if u.friendship === 'pending_them'}<span class="pill"><Clock size={11} /> Requested</span>
            {:else if u.friendship === 'pending_me'}<button class="btn btn-sm btn-primary" onclick={() => act(() => api.social.accept(u.id), 'Friend added')}><Check size={14} /> Accept</button>
            {:else}<span class="pill pill-success"><Check size={11} /> Friends</span>{/if}
          </div>
        {/each}
      </div>
    {:else if q.trim().length >= 2 && !searching}
      <p class="faint none">No users match “{q}”.</p>
    {/if}
  </div>

  {#if data}
    {#if data.incoming.length}
      <section class="animate-rise">
        <div class="section-head"><h2>Requests <span class="pill pill-brand">{data.incoming.length}</span></h2></div>
        <div class="card rows pad">
          {#each data.incoming as r (r.id)}
            <div class="row">
              <a href="/u/{encodeURIComponent(r.username)}" class="who"><Avatar name={r.username} size={34} /><span>{r.username}<small class="faint">wants to be friends · {relTime(r.created_at)}</small></span></a>
              <div class="acts">
                <button class="btn btn-sm btn-primary" onclick={() => act(() => api.social.accept(r.id), `You and ${r.username} are now friends`)}><Check size={14} /> Accept</button>
                <button class="btn btn-sm btn-secondary" onclick={() => act(() => api.social.remove(r.id), 'Request declined')}><X size={14} /></button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}
    {#if data.outgoing.length}
      <section class="animate-rise">
        <div class="section-head"><h2>Sent</h2></div>
        <div class="card rows pad">
          {#each data.outgoing as r (r.id)}
            <div class="row"><a href="/u/{encodeURIComponent(r.username)}" class="who"><Avatar name={r.username} size={34} /><span>{r.username}<small class="faint">sent {relTime(r.created_at)}</small></span></a><button class="btn btn-sm btn-ghost" onclick={() => act(() => api.social.remove(r.id), 'Request cancelled')}>Cancel</button></div>
          {/each}
        </div>
      </section>
    {/if}
    <section class="animate-rise">
      <div class="section-head"><h2>Your friends <span class="pill">{data.friends.length}</span></h2></div>
      {#if !data.friends.length}
        <EmptyState title="No friends yet" text="Search for someone above and send a request.">{#snippet icon()}<Users size={26} />{/snippet}</EmptyState>
      {:else}
        <div class="card rows pad">
          {#each data.friends as f (f.id)}
            <div class="row"><a href="/u/{encodeURIComponent(f.username)}" class="who"><Avatar name={f.username} size={34} /><span>{f.username}<small class="faint">friends since {relTime(f.since)}</small></span></a><button class="icon-btn" title="Remove friend" onclick={() => unfriend(f.id, f.username)}><UserMinus size={16} /></button></div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<style>
  .narrow { max-width: 46rem; }
  .find { padding: 0.625rem; margin-bottom: 1.5rem; }
  .in { position: relative; display: block; }
  .in :global(.ic) { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: rgb(var(--c-text-3)); }
  .in :global(.ld) { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); color: rgb(var(--c-brand)); }
  .in .input { padding-left: 2.4rem; }
  .none { padding: 0.75rem 0.5rem 0.25rem; }
  .rows { display: flex; flex-direction: column; }
  .rows.pad { padding: 0.25rem 0.75rem; }
  .find .rows { padding-top: 0.5rem; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.6rem 0; }
  .rows .row + .row { border-top: 1px solid rgb(var(--c-border)); }
  .who { display: flex; align-items: center; gap: 0.625rem; font-weight: 600; min-width: 0; }
  .who span { display: flex; flex-direction: column; line-height: 1.25; }
  .who small { font-weight: 500; font-size: 0.75rem; }
  .who:hover { color: rgb(var(--c-brand)); }
  .acts { display: flex; gap: 0.35rem; }
  section { margin-bottom: 1.5rem; }
</style>
