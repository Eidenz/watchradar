<script lang="ts">
  import { Lock, UserPlus, Check, X, Clock, UserMinus, Film, Tv, Clock3, Star, Repeat, Users, Trophy, Play, Heart, CheckCheck, ArrowRight, Settings } from '@lucide/svelte';
  import { api, type Profile } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { toast } from '../lib/toast.svelte';
  import { confirm } from '../lib/confirm.svelte';
  import { minutesToText, dateText, TIERS } from '../lib/format';
  import Avatar from '../components/Avatar.svelte';
  import MediaCard from '../components/MediaCard.svelte';
  import Rail from '../components/Rail.svelte';
  import AchievementBadge from '../components/AchievementBadge.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import Modal from '../components/Modal.svelte';

  let { username }: { username: string } = $props();
  let p = $state<Profile | null>(null);
  let missing = $state(false);
  let showAll = $state(false);

  async function load() {
    missing = false;
    try {
      p = await api.social.profile(username);
    } catch (e: any) {
      if (e.status === 404) missing = true;
      else toast.error(e.message);
    }
  }
  $effect(() => {
    void username;
    load();
  });
  async function act(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  const sortedAch = $derived([...(p?.achievements ?? [])].sort((a, b) => b.tier - a.tier || a.name.localeCompare(b.name)));
  const byTier = $derived([5, 4, 3, 2, 1].map((t) => ({ tier: t, items: sortedAch.filter((a) => a.tier === t) })).filter((g) => g.items.length));
</script>

<div class="page">
  {#if missing}
    <EmptyState title="User not found" text="No one goes by that name here."><a class="btn btn-secondary" href="/">Home</a></EmptyState>
  {:else if p}
    <div class="head card animate-rise">
      <Avatar name={p.user.username} size={72} />
      <div class="who">
        <h1>{p.user.username}</h1>
        <p class="muted">Member since {dateText(p.user.created_at, { year: 'numeric', month: 'long' })}{#if p.stats}{' · '}{p.stats.friends} friend{p.stats.friends === 1 ? '' : 's'}{/if}</p>
      </div>
      <div class="acts">
        {#if p.is_owner}
          <a class="btn btn-secondary" href="/settings/privacy"><Settings size={16} /> Privacy: {p.user.profile_privacy?.replace('_', ' ')}</a>
        {:else if auth.user}
          {#if p.friendship === 'none'}<button class="btn btn-primary" onclick={() => act(() => api.social.request(p!.user.id), 'Request sent')}><UserPlus size={16} /> Add friend</button>
          {:else if p.friendship === 'pending_them'}<button class="btn btn-secondary" onclick={() => act(() => api.social.remove(p!.user.id), 'Request cancelled')}><Clock size={16} /> Requested</button>
          {:else if p.friendship === 'pending_me'}
            <button class="btn btn-primary" onclick={() => act(() => api.social.accept(p!.user.id), 'Friend added')}><Check size={16} /> Accept</button>
            <button class="btn btn-secondary" onclick={() => act(() => api.social.remove(p!.user.id), 'Declined')}><X size={16} /></button>
          {:else if p.friendship === 'accepted'}
            <button class="btn btn-secondary" onclick={async () => { if (await confirm.ask({ title: `Remove ${p!.user.username}?`, confirmLabel: 'Remove', danger: true })) act(() => api.social.remove(p!.user.id), 'Friend removed'); }}><UserMinus size={16} /> Friends</button>
          {/if}
        {:else}
          <a class="btn btn-primary" href="/login?next={encodeURIComponent(location.pathname)}">Sign in</a>
        {/if}
      </div>
    </div>

    {#if p.access !== 'public'}
      <EmptyState title={p.access === 'login_required' ? 'Sign in to view this profile' : p.access === 'friends_only' ? 'Friends only' : 'This profile is private'} text={p.access === 'friends_only' ? `Only ${p.user.username}’s friends can see their library.` : undefined}>
        {#snippet icon()}<Lock size={26} />{/snippet}
      </EmptyState>
    {:else if p.stats}
      <div class="stats animate-rise">
        <div class="st card"><Tv size={18} /><div><b>{p.stats.completed_tv}</b><span>series</span></div></div>
        <div class="st card"><Film size={18} /><div><b>{p.stats.completed_movies}</b><span>movies</span></div></div>
        <div class="st card"><Play size={18} /><div><b>{p.stats.episodes.toLocaleString()}</b><span>episodes</span></div></div>
        <div class="st card"><Clock3 size={18} /><div><b>{minutesToText(p.stats.minutes)}</b><span>watched</span></div></div>
        <div class="st card"><Star size={18} /><div><b>{p.stats.rated}</b><span>rated</span></div></div>
        <div class="st card"><Repeat size={18} /><div><b>{p.stats.rewatched}</b><span>rewatched</span></div></div>
      </div>

      {#if sortedAch.length}
        <section class="ach card animate-rise">
          <div class="section-head"><h2><Trophy size={18} /> Achievements <span class="pill">{sortedAch.length}</span></h2><button class="btn btn-ghost btn-sm" onclick={() => (showAll = true)}>View all <ArrowRight size={14} /></button></div>
          <div class="badges">{#each sortedAch.slice(0, 12) as a (a.id)}<AchievementBadge {a} />{/each}{#if sortedAch.length > 12}<button class="more" onclick={() => (showAll = true)}>+{sortedAch.length - 12}</button>{/if}</div>
        </section>
      {/if}

      {#if p.genres?.length}
        <div class="genres animate-rise">{#each p.genres as g}<span class="pill">{g.name} <b>{g.count}</b></span>{/each}</div>
      {/if}

      {#if p.watching?.length}
        <Rail title="Currently watching" count={p.watching.length}>{#snippet icon()}<Play size={18} />{/snippet}
          {#each p.watching as c, i (c.media.id)}<div class="slot"><MediaCard media={c.media as any} tracking={c.tracking} showStatus={false} delay={i * 30} /></div>{/each}
        </Rail>
      {/if}
      {#if p.favorites?.length}
        <Rail title="Favourites" count={p.favorites.length}>{#snippet icon()}<Heart size={18} />{/snippet}
          {#each p.favorites as c, i (c.media.id)}<div class="slot"><MediaCard media={c.media as any} tracking={c.tracking} showStatus={false} delay={i * 30} /></div>{/each}
        </Rail>
      {/if}
      {#if p.recent?.length}
        <Rail title="Recently completed" href="/u/{encodeURIComponent(p.user.username)}/library">{#snippet icon()}<CheckCheck size={18} />{/snippet}
          {#each p.recent as c, i (c.media.id)}<div class="slot"><MediaCard media={c.media as any} tracking={c.tracking} showStatus={false} delay={i * 30} /></div>{/each}
        </Rail>
      {:else}
        <EmptyState title="Nothing completed yet" />
      {/if}
      <a class="btn btn-secondary" href="/u/{encodeURIComponent(p.user.username)}/library">Browse {p.is_owner ? 'your' : `${p.user.username}’s`} library <ArrowRight size={16} /></a>
    {/if}
  {:else}
    <div class="skeleton head-sk"></div>
  {/if}
</div>

<Modal bind:open={showAll} title="Achievements" size="lg">
  {#each byTier as g}
    <h3 class="tier-h tier-{g.tier}">{TIERS[g.tier]} <span class="faint">{g.items.length}</span></h3>
    <div class="all">
      {#each g.items as a (a.id)}
        <div class="arow"><AchievementBadge {a} size={40} /><div><b>{a.name}</b><div class="faint">{a.description}</div></div></div>
      {/each}
    </div>
  {/each}
</Modal>

<style>
  .head { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .who { flex: 1; min-width: 10rem; }
  .who h1 { font-size: 1.5rem; }
  .acts { display: flex; gap: 0.5rem; }
  .head-sk { height: 7rem; border-radius: var(--radius-lg); }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: 0.625rem; margin-bottom: 1rem; }
  .st { display: flex; align-items: center; gap: 0.625rem; padding: 0.75rem 0.875rem; color: rgb(var(--c-brand)); }
  .st div { display: flex; flex-direction: column; line-height: 1.15; color: rgb(var(--c-text-1)); }
  .st b { font-size: 1.125rem; }
  .st span { font-size: 0.75rem; color: rgb(var(--c-text-3)); }
  .ach { padding: 1rem 1.125rem; margin-bottom: 1rem; }
  .badges { display: flex; flex-wrap: wrap; gap: 0.625rem; align-items: center; }
  .more { width: 44px; height: 44px; border-radius: 999px; background: rgb(var(--c-subtle)); font-weight: 700; font-size: 0.75rem; color: rgb(var(--c-text-2)); }
  .genres { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 1.5rem; }
  .genres b { color: rgb(var(--c-text-1)); }
  .slot { width: 9.5rem; }
  .tier-h { font-size: 0.875rem; margin: 0.75rem 0 0.5rem; display: flex; gap: 0.5rem; align-items: baseline; }
  .tier-1 { color: #b87333; } .tier-2 { color: #8a949c; } .tier-3 { color: #d4a017; } .tier-4 { color: #8b5cf6; } .tier-5 { color: #06b6d4; }
  .all { display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 0.5rem; }
  .arow { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border-radius: var(--radius-md); background: rgb(var(--c-subtle)); font-size: 0.8125rem; }
</style>
