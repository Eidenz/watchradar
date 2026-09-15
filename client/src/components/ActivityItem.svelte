<script lang="ts">
  import { Check, Star, Plus, Tv, Repeat, ListPlus, List, Activity } from '@lucide/svelte';
  import type { Activity as ActivityT } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { preferredTitle, relTime, STATUS_LABEL } from '../lib/format';
  import { titleHref } from '../lib/router.svelte';
  import Poster from './Poster.svelte';
  import Avatar from './Avatar.svelte';

  let { activity: a, delay = 0 }: { activity: ActivityT; delay?: number } = $props();
  const title = $derived(a.media ? preferredTitle(a.media, auth.titleLanguage) : '');
  const d = $derived(a.details || {});
  const kind = $derived.by(() => {
    switch (a.type) {
      case 'COMPLETED_MEDIA': return { icon: Check, tone: 'success', text: 'completed' };
      case 'COMPLETED_REWATCH': return { icon: Repeat, tone: 'brand', text: `finished watch #${d.run ?? ''} of` };
      case 'RATED_MEDIA': return { icon: Star, tone: 'signal', text: `rated ${typeof d.rating === 'number' ? d.rating / 2 : '?'}★` };
      case 'TRACKED_MEDIA': return { icon: Plus, tone: 'info', text: `added to ${STATUS_LABEL[d.status as keyof typeof STATUS_LABEL] ?? 'their library'}:` };
      case 'WATCHED_EPISODE': return { icon: Tv, tone: 'brand', text: d.count > 1 ? `watched ${d.count} episodes up to S${d.season_number}E${d.episode_number} of` : `watched S${d.season_number}E${d.episode_number} of` };
      case 'STARTED_REWATCH': return { icon: Repeat, tone: 'warning', text: `started rewatching${d.run ? ` (#${d.run})` : ''}` };
      case 'ADDED_TO_LIST': return { icon: ListPlus, tone: 'brand', text: `added to list “${a.list?.name || d.listName}”:` };
      case 'CREATED_LIST': return { icon: List, tone: 'info', text: `created list “${a.list?.name || d.listName}”` };
      default: return { icon: Activity, tone: 'brand', text: a.type.toLowerCase().replace(/_/g, ' ') };
    }
  });
</script>

<div class="act card animate-rise" style:animation-delay="{delay}ms">
  <a href="/u/{encodeURIComponent(a.user.username)}" class="av"><Avatar name={a.user.username} size={36} /></a>
  <div class="body">
    <div class="line">
      <a class="user" href="/u/{encodeURIComponent(a.user.username)}">{a.user.username}</a>
      <span class="muted">{kind.text}</span>
      {#if a.media}<a class="media" href={titleHref(a.media as any)}>{title}</a>{/if}
    </div>
    <div class="time faint"><span class="ic tone-{kind.tone}"><kind.icon size={12} /></span>{relTime(a.created_at)}</div>
  </div>
  {#if a.media?.poster_path}
    <a class="poster" href={titleHref(a.media as any)}><Poster path={a.media.poster_path} size="w92" type={a.media.media_type} radius="0.375rem" /></a>
  {/if}
</div>

<style>
  .act { display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 0.75rem; }
  .body { flex: 1; min-width: 0; }
  .line { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: baseline; font-size: 0.875rem; }
  .user { font-weight: 700; }
  .user:hover, .media:hover { color: rgb(var(--c-brand)); }
  .media { font-weight: 600; }
  .time { display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; margin-top: 0.15rem; }
  .ic { width: 1.1rem; height: 1.1rem; border-radius: 999px; display: grid; place-items: center; color: #fff; }
  .tone-success { background: rgb(var(--c-success)); }
  .tone-brand { background: rgb(var(--c-brand)); }
  .tone-signal { background: rgb(var(--c-signal)); }
  .tone-info { background: rgb(var(--c-info)); }
  .tone-warning { background: rgb(var(--c-warning)); }
  .poster { width: 2.25rem; flex-shrink: 0; }
</style>
