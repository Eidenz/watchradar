<script lang="ts">
  import { Bell, Search, Sun, Moon } from '@lucide/svelte';
  import Logo from './Logo.svelte';
  import Avatar from './Avatar.svelte';
  import { auth } from '../lib/auth.svelte';
  import { theme } from '../lib/theme.svelte';
</script>

<header class="topbar">
  <a class="brand" href="/"><Logo size={28} /><span>Watch<span class="accent">Radar</span></span></a>
  <div class="spacer"></div>
  <a class="icon-btn" href="/search" aria-label="Search"><Search size={20} /></a>
  <button class="icon-btn" aria-label="Toggle theme" onclick={() => theme.toggle()}>{#if theme.dark}<Sun size={19} />{:else}<Moon size={19} />{/if}</button>
  <a class="icon-btn" href="/notifications" aria-label="Notifications">
    <Bell size={20} />
    {#if auth.unread}<span class="ping">{auth.unread > 9 ? '9+' : auth.unread}</span>{/if}
  </a>
  {#if auth.user}
    <a href="/settings" aria-label="Account" class="av"><Avatar name={auth.user.username} size={30} /></a>
  {/if}
</header>

<style>
  .topbar {
    position: sticky; top: 0; z-index: 30; height: var(--topbar-h); display: flex; align-items: center; gap: 0.25rem; padding: 0 0.75rem 0 1rem;
    background: rgb(var(--c-surface) / 0.8); backdrop-filter: blur(14px); border-bottom: 1px solid rgb(var(--c-border));
  }
  .brand { display: flex; align-items: center; gap: 0.5rem; font-weight: 800; letter-spacing: -0.02em; font-size: 1.0625rem; }
  .accent { color: rgb(var(--c-brand)); }
  .spacer { flex: 1; }
  .ping { position: absolute; top: 0.2rem; right: 0.2rem; min-width: 1rem; height: 1rem; padding: 0 0.25rem; border-radius: 999px; background: rgb(var(--c-brand)); color: rgb(var(--c-on-brand)); font-size: 0.625rem; font-weight: 700; display: grid; place-items: center; }
  .av { margin-left: 0.25rem; }
</style>
