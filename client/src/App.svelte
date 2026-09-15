<script lang="ts">
  import { fade } from 'svelte/transition';
  import { router } from './lib/router.svelte';
  import { auth } from './lib/auth.svelte';
  import { theme } from './lib/theme.svelte';
  import Backdrop from './components/Backdrop.svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Topbar from './components/Topbar.svelte';
  import BottomNav from './components/BottomNav.svelte';
  import ToastHost from './components/ToastHost.svelte';
  import ConfirmHost from './components/ConfirmHost.svelte';
  import Logo from './components/Logo.svelte';
  import Login from './pages/Login.svelte';
  import Register from './pages/Register.svelte';
  import Home from './pages/Home.svelte';
  import Library from './pages/Library.svelte';
  import Search from './pages/Search.svelte';
  import Title from './pages/Title.svelte';
  import Lists from './pages/Lists.svelte';
  import ListDetail from './pages/ListDetail.svelte';
  import Feed from './pages/Feed.svelte';
  import Friends from './pages/Friends.svelte';
  import Profile from './pages/Profile.svelte';
  import ProfileLibrary from './pages/ProfileLibrary.svelte';
  import Stats from './pages/Stats.svelte';
  import Settings from './pages/Settings.svelte';
  import Notifications from './pages/Notifications.svelte';
  import Admin from './pages/Admin.svelte';
  import NotFound from './pages/NotFound.svelte';

  void theme;
  auth.load();

  const route = $derived(router.current);
  const PUBLIC = new Set(['login', 'register', 'title', 'profile', 'profile-library', 'missing']);
  const needsAuth = $derived(!PUBLIC.has(route.page));
  const routeKey = $derived(JSON.stringify(route));

  // Redirects once the session is known.
  $effect(() => {
    if (!auth.ready) return;
    if (needsAuth && !auth.user) router.go(`/login${route.page === 'home' ? '' : `?next=${encodeURIComponent(location.pathname + location.search)}`}`, { replace: true });
    else if (auth.user && (route.page === 'login' || route.page === 'register')) router.go(router.query.get('next') || '/', { replace: true });
  });

  // Intercept same-origin link clicks.
  function onClick(e: MouseEvent) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest('a');
    if (!a || a.target === '_blank' || a.hasAttribute('download') || a.origin !== location.origin) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('/api/')) return;
    e.preventDefault();
    router.go(a.pathname + a.search);
  }

  // Keep unread counts fresh while the app is open.
  $effect(() => {
    if (!auth.user) return;
    const t = setInterval(() => auth.refreshCounts(), 120_000);
    return () => clearInterval(t);
  });

  const shell = $derived(!!auth.user && !['login', 'register'].includes(route.page));
</script>

<svelte:window onclick={onClick} />

<Backdrop />

{#if !auth.ready}
  <div class="splash" out:fade={{ duration: 200 }}><Logo size={56} /></div>
{:else if shell}
  <div class="shell">
    <div class="side"><Sidebar /></div>
    <div class="top"><Topbar /></div>
    <main>
      {#key routeKey}
        <div class="view">
          {#if route.page === 'home'}<Home />
          {:else if route.page === 'library'}<Library status={route.status} />
          {:else if route.page === 'search'}<Search />
          {:else if route.page === 'title'}<Title type={route.type} tmdbId={route.tmdbId} />
          {:else if route.page === 'lists'}<Lists />
          {:else if route.page === 'list'}<ListDetail id={route.id} />
          {:else if route.page === 'feed'}<Feed />
          {:else if route.page === 'friends'}<Friends />
          {:else if route.page === 'profile'}<Profile username={route.username} />
          {:else if route.page === 'profile-library'}<ProfileLibrary username={route.username} />
          {:else if route.page === 'stats'}<Stats />
          {:else if route.page === 'settings'}<Settings tab={route.tab} />
          {:else if route.page === 'notifications'}<Notifications />
          {:else if route.page === 'admin'}{#if auth.user?.is_admin}<Admin />{:else}<NotFound />{/if}
          {:else}<NotFound />{/if}
        </div>
      {/key}
    </main>
    <div class="bottom"><BottomNav /></div>
  </div>
{:else}
  {#key routeKey}
    <div class="view">
      {#if route.page === 'login'}<Login />
      {:else if route.page === 'register'}<Register />
      {:else if route.page === 'title'}<div class="guest"><Title type={route.type} tmdbId={route.tmdbId} /></div>
      {:else if route.page === 'profile'}<div class="guest"><Profile username={route.username} /></div>
      {:else if route.page === 'profile-library'}<div class="guest"><ProfileLibrary username={route.username} /></div>
      {:else}<NotFound />{/if}
    </div>
  {/key}
{/if}

<ToastHost />
<ConfirmHost />

<style>
  .splash { min-height: 100dvh; display: grid; place-items: center; }
  .shell { min-height: 100dvh; }
  .side { display: none; }
  .bottom { display: block; }
  main { padding-bottom: calc(var(--bottomnav-h) + env(safe-area-inset-bottom)); }
  @media (min-width: 1024px) {
    .side { display: block; }
    .top, .bottom { display: none; }
    main { margin-left: var(--sidebar-w); padding-bottom: 0; }
  }
  .view { animation: rise var(--dur-4) var(--ease-out) both; }
  .guest { padding-top: 0.5rem; }
</style>
