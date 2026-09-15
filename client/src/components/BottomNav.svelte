<script lang="ts">
  import { Home, Library, Search, Activity, Menu, Users, ListVideo, BarChart3, Settings, Shield, Bell, LogOut, X } from '@lucide/svelte';
  import { fly, fade } from 'svelte/transition';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';

  let more = $state(false);
  const p = $derived(router.current.page);
  const moreItems = $derived([
    { href: '/lists', label: 'Lists', icon: ListVideo },
    { href: '/friends', label: 'Friends', icon: Users, badge: auth.pendingRequests },
    { href: '/notifications', label: 'Notifications', icon: Bell, badge: auth.unread },
    { href: '/stats', label: 'Stats', icon: BarChart3 },
    { href: `/u/${encodeURIComponent(auth.user?.username ?? '')}`, label: 'Profile', icon: Users },
    { href: '/settings', label: 'Settings', icon: Settings },
    ...(auth.user?.is_admin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
  ]);
  const moreActive = $derived(['lists', 'list', 'friends', 'notifications', 'stats', 'settings', 'admin', 'profile', 'profile-library'].includes(p));
  $effect(() => {
    void router.path;
    more = false;
  });
</script>

<nav class="bottom">
  <a class="tab" class:active={p === 'home'} href="/"><Home size={22} /><span>Home</span></a>
  <a class="tab" class:active={p === 'library'} href="/library"><Library size={22} /><span>Library</span></a>
  <a class="tab" class:active={p === 'search'} href="/search"><Search size={22} /><span>Search</span></a>
  <a class="tab" class:active={p === 'feed'} href="/feed"><Activity size={22} /><span>Feed</span></a>
  <button class="tab" class:active={moreActive} onclick={() => (more = !more)}>
    <Menu size={22} /><span>More</span>
    {#if auth.unread + auth.pendingRequests}<span class="dotb"></span>{/if}
  </button>
</nav>

{#if more}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="scrim" role="presentation" transition:fade={{ duration: 150 }} onclick={() => (more = false)}></div>
  <div class="sheet" transition:fly={{ y: 40, duration: 240 }}>
    <div class="sheet-head"><strong>{auth.user?.username}</strong><button class="icon-btn" onclick={() => (more = false)} aria-label="Close"><X size={18} /></button></div>
    <div class="grid">
      {#each moreItems as it}
        <a class="cell" href={it.href}><it.icon size={22} /><span>{it.label}</span>{#if it.badge}<span class="badge">{it.badge}</span>{/if}</a>
      {/each}
      <button class="cell danger" onclick={() => auth.logout()}><LogOut size={22} /><span>Sign out</span></button>
    </div>
  </div>
{/if}

<style>
  .bottom {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; height: calc(var(--bottomnav-h) + env(safe-area-inset-bottom)); padding-bottom: env(safe-area-inset-bottom);
    display: grid; grid-template-columns: repeat(5, 1fr); background: rgb(var(--c-surface) / 0.85); backdrop-filter: blur(14px); border-top: 1px solid rgb(var(--c-border));
  }
  .tab { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.15rem; font-size: 0.6875rem; font-weight: 600; color: rgb(var(--c-text-3)); transition: color var(--dur-2) var(--ease), transform var(--dur-2) var(--ease-spring); }
  .tab:active { transform: scale(0.92); }
  .tab.active { color: rgb(var(--c-brand)); }
  .dotb { position: absolute; top: 0.5rem; right: calc(50% - 0.9rem); width: 0.5rem; height: 0.5rem; border-radius: 999px; background: rgb(var(--c-brand)); }
  .scrim { position: fixed; inset: 0; z-index: 45; background: rgb(0 0 0 / 0.4); backdrop-filter: blur(2px); }
  .sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 46; background: rgb(var(--c-raised)); border-radius: var(--radius-xl) var(--radius-xl) 0 0; padding: 0.75rem 1rem calc(1rem + env(safe-area-inset-bottom)); box-shadow: var(--shadow-lg); }
  .sheet-head { display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.25rem 0.75rem; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; }
  .cell { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; padding: 0.875rem 0.25rem; border-radius: var(--radius-md); background: rgb(var(--c-subtle)); font-size: 0.75rem; font-weight: 600; color: rgb(var(--c-text-1)); }
  .cell.danger { color: rgb(var(--c-danger)); }
  .badge { position: absolute; top: 0.4rem; right: 0.4rem; min-width: 1.1rem; height: 1.1rem; padding: 0 0.3rem; border-radius: 999px; background: rgb(var(--c-brand)); color: rgb(var(--c-on-brand)); font-size: 0.625rem; display: grid; place-items: center; }
</style>
