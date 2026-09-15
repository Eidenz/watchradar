<script lang="ts">
  import { Home, Library, Search, Activity, Users, ListVideo, BarChart3, Settings, Shield, Bell, Sun, Moon, LogOut, ChevronDown } from '@lucide/svelte';
  import Logo from './Logo.svelte';
  import Avatar from './Avatar.svelte';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';
  import { theme } from '../lib/theme.svelte';

  type Item = { href: string; label: string; icon: any; active: boolean; badge?: number };
  const groups = $derived<{ label?: string; items: Item[] }[]>([
    {
      items: [
        { href: '/', label: 'Home', icon: Home, active: router.current.page === 'home' },
        { href: '/library', label: 'Library', icon: Library, active: router.current.page === 'library' },
        { href: '/search', label: 'Search', icon: Search, active: router.current.page === 'search' },
        { href: '/lists', label: 'Lists', icon: ListVideo, active: router.current.page === 'lists' || router.current.page === 'list' },
      ],
    },
    {
      label: 'Social',
      items: [
        { href: '/feed', label: 'Feed', icon: Activity, active: router.current.page === 'feed' },
        { href: '/friends', label: 'Friends', icon: Users, active: router.current.page === 'friends', badge: auth.pendingRequests },
      ],
    },
    {
      label: 'You',
      items: [
        { href: '/notifications', label: 'Notifications', icon: Bell, active: router.current.page === 'notifications', badge: auth.unread },
        { href: '/stats', label: 'Stats', icon: BarChart3, active: router.current.page === 'stats' },
        { href: '/settings', label: 'Settings', icon: Settings, active: router.current.page === 'settings' },
        ...(auth.user?.is_admin ? [{ href: '/admin', label: 'Admin', icon: Shield, active: router.current.page === 'admin' } as Item] : []),
      ],
    },
  ]);
  let menu = $state(false);
</script>

<aside class="sidebar">
  <a class="brand" href="/">
    <Logo size={32} />
    <span class="word">Watch<span class="accent">Radar</span></span>
  </a>

  <nav>
    {#each groups as g}
      {#if g.label}<div class="group-label">{g.label}</div>{/if}
      {#each g.items as it}
        <a class="nav-item" class:active={it.active} href={it.href}>
          <it.icon size={18} />
          <span>{it.label}</span>
          {#if it.badge}<span class="badge">{it.badge}</span>{/if}
        </a>
      {/each}
    {/each}
  </nav>

  <div class="bottom">
    {#if auth.user}
      <div class="user-wrap">
        <button class="user" onclick={() => (menu = !menu)} aria-expanded={menu}>
          <Avatar name={auth.user.username} size={32} />
          <span class="uname truncate">{auth.user.username}</span>
          <ChevronDown size={16} class="chev" />
        </button>
        {#if menu}
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div class="menu-scrim" role="presentation" onclick={() => (menu = false)}></div>
          <div class="menu animate-rise">
            <a class="menu-item" href="/u/{encodeURIComponent(auth.user.username)}" onclick={() => (menu = false)}><Users size={16} /> My profile</a>
            <button class="menu-item" onclick={() => { theme.toggle(); }}>
              {#if theme.dark}<Sun size={16} /> Light mode{:else}<Moon size={16} /> Dark mode{/if}
            </button>
            <button class="menu-item danger" onclick={() => auth.logout()}><LogOut size={16} /> Sign out</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</aside>

<style>
  .sidebar {
    position: fixed; top: 0; left: 0; bottom: 0; width: var(--sidebar-w); display: flex; flex-direction: column;
    padding: 1.1rem 0.875rem 1rem; background: rgb(var(--c-surface) / 0.75); backdrop-filter: blur(14px);
    border-right: 1px solid rgb(var(--c-border)); z-index: 30;
  }
  .brand { display: flex; align-items: center; gap: 0.625rem; padding: 0.25rem 0.5rem 1.1rem; font-weight: 800; font-size: 1.125rem; letter-spacing: -0.02em; }
  .accent { color: rgb(var(--c-brand)); }
  nav { display: flex; flex-direction: column; gap: 0.125rem; flex: 1; overflow-y: auto; }
  .group-label { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgb(var(--c-text-3)); padding: 1rem 0.75rem 0.375rem; }
  .nav-item {
    display: flex; align-items: center; gap: 0.75rem; padding: 0 0.75rem; height: 2.5rem; border-radius: var(--radius-sm); font-weight: 600; color: rgb(var(--c-text-2));
    transition: background-color var(--dur-2) var(--ease), color var(--dur-2) var(--ease), transform var(--dur-2) var(--ease-spring);
  }
  .nav-item:hover { background: rgb(var(--c-subtle)); color: rgb(var(--c-text-1)); }
  .nav-item:active { transform: scale(0.98); }
  .nav-item.active { background: rgb(var(--c-brand) / 0.12); color: rgb(var(--c-brand)); }
  .badge { margin-left: auto; min-width: 1.25rem; height: 1.25rem; padding: 0 0.35rem; border-radius: 999px; background: rgb(var(--c-brand)); color: rgb(var(--c-on-brand)); font-size: 0.6875rem; font-weight: 700; display: grid; place-items: center; }
  .bottom { padding-top: 0.75rem; border-top: 1px solid rgb(var(--c-border)); }
  .user-wrap { position: relative; }
  .user { display: flex; align-items: center; gap: 0.625rem; width: 100%; padding: 0.4rem 0.5rem; border-radius: var(--radius-sm); text-align: left; transition: background-color var(--dur-2) var(--ease); }
  .user:hover { background: rgb(var(--c-subtle)); }
  .uname { font-weight: 600; flex: 1; }
  .user :global(.chev) { color: rgb(var(--c-text-3)); }
  .menu-scrim { position: fixed; inset: 0; z-index: 40; }
  .menu { position: absolute; left: 0; right: 0; bottom: calc(100% + 0.375rem); z-index: 41; background: rgb(var(--c-raised)); border: 1px solid rgb(var(--c-border)); border-radius: var(--radius-md); box-shadow: var(--shadow-pop); padding: 0.375rem; }
  .menu-item { display: flex; align-items: center; gap: 0.6rem; width: 100%; padding: 0.55rem 0.7rem; border-radius: 0.5rem; font-weight: 600; color: rgb(var(--c-text-1)); text-align: left; }
  .menu-item:hover { background: rgb(var(--c-subtle)); }
  .menu-item.danger { color: rgb(var(--c-danger)); }
</style>
