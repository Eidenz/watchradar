<script lang="ts">
  import { ArrowLeft, Plus, Star, Repeat, ListPlus, Lock, Unlock, RefreshCw, Trash2, History, Play, Check, Loader2, Tv, Film, Clock, CalendarClock, Users, MessageSquare, StickyNote, X, ExternalLink, Sparkles } from '@lucide/svelte';
  import { fade } from 'svelte/transition';
  import { api, type TitleView, type Status, type Comment, type HistoryEvent, type MediaType } from '../lib/api';
  import { auth } from '../lib/auth.svelte';
  import { router } from '../lib/router.svelte';
  import { toast } from '../lib/toast.svelte';
  import { confirm } from '../lib/confirm.svelte';
  import { preferredTitle, img, year, minutesToText, dateText, relTime, airsIn, STATUS_LABEL, STATUS_ORDER, watchCountBadge } from '../lib/format';
  import Poster from '../components/Poster.svelte';
  import StarRating from '../components/StarRating.svelte';
  import StatusPicker from '../components/StatusPicker.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import SeasonPanel from '../components/SeasonPanel.svelte';
  import ListPicker from '../components/ListPicker.svelte';
  import Modal from '../components/Modal.svelte';
  import Avatar from '../components/Avatar.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let { type, tmdbId }: { type: MediaType; tmdbId: number } = $props();
  let view = $state<TitleView | null>(null);
  let error = $state('');
  let season = $state<number | null>(null);
  let busy = $state(false);
  let listsOpen = $state(false);
  let historyOpen = $state(false);
  let history = $state<HistoryEvent[] | null>(null);
  let notesOpen = $state(false);
  let notes = $state('');
  let comments = $state<Comment[]>([]);
  let myComment = $state('');
  let commentBusy = $state(false);
  let addMenu = $state(false);

  const media = $derived(view?.media ?? null);
  const t = $derived(view?.tracking ?? null);
  const p = $derived(view?.progress ?? null);
  const title = $derived(preferredTitle(media, auth.titleLanguage));
  const isTv = $derived(media?.media_type === 'tv');
  const backdrop = $derived(img(media?.backdrop_path, 'w1280'));
  const seasons = $derived(view?.seasons ?? []);
  const currentSeason = $derived(seasons.find((s) => s.season_number === season) ?? null);
  const mine = $derived(comments.find((c) => c.user_id === auth.user?.id) ?? null);
  const others = $derived(comments.filter((c) => c.user_id !== auth.user?.id));
  const badge = $derived(t ? watchCountBadge(t.watch_count) : null);

  async function load() {
    error = '';
    try {
      const v = await api.titles.get(type, tmdbId);
      apply(v, true);
      document.title = `${preferredTitle(v.media, auth.titleLanguage)} · WatchRadar`;
      if (auth.user) api.titles.comments(type, tmdbId).then((r) => { comments = r.comments; myComment = r.comments.find((c) => c.user_id === auth.user?.id)?.body ?? ''; }).catch(() => {});
    } catch (e: any) {
      error = e.message;
    }
  }
  function apply(v: TitleView, first = false) {
    view = v;
    notes = v.tracking?.notes ?? '';
    if (v.seasons.length && (first || season === null || !v.seasons.some((s) => s.season_number === season))) {
      const pick = v.progress?.next_episode?.season_number ?? v.progress?.season?.number ?? v.seasons.find((s) => s.season_number > 0)?.season_number ?? v.seasons[0].season_number;
      season = pick;
    }
  }
  $effect(() => {
    void type;
    void tmdbId;
    load();
    return () => { document.title = 'WatchRadar'; };
  });

  async function act(fn: () => Promise<TitleView>, msg?: string) {
    busy = true;
    try {
      const v = await fn();
      apply(v);
      if (v.completed) toast.success(`${title} completed! 🎉`);
      else if (msg) toast.success(msg);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      busy = false;
    }
  }
  const track = (status: Status) => { addMenu = false; act(() => api.titles.track(type, tmdbId, { status }), `Added to ${STATUS_LABEL[status]}`); };
  const setStatus = (s: Status) => t && s !== t.status && act(() => api.media.status(media!.id!, s), `Moved to ${STATUS_LABEL[s]}`);
  const rate = (r: number | null) => act(() => api.media.rating(media!.id!, r), r ? `Rated ${r / 2}★` : 'Rating cleared');
  const markNext = () => p?.next_episode && act(() => api.media.episode(media!.id!, p.next_episode!.season_number, p.next_episode!.episode_number, true));
  const togglePrivacy = () => act(() => api.media.privacy(media!.id!, !t!.is_private), t!.is_private ? 'Now visible to friends' : 'Hidden from your public profile');
  const refresh = () => act(() => api.media.refresh(media!.id!), 'Refreshed from TMDB');
  async function rewatch() {
    if (isTv) {
      if (await confirm.ask({ title: `Rewatch ${title}?`, message: `Starts play-through #${(t?.watch_count ?? 0) + 1}. Your earlier viewings stay in your history.`, confirmLabel: 'Start rewatch' }))
        act(() => api.media.startRewatch(media!.id!), 'Rewatch started — enjoy!');
    } else act(() => api.media.startRewatch(media!.id!), `Logged viewing #${(t?.watch_count ?? 0) + 1}`);
  }
  async function cancelRewatch() {
    if (await confirm.ask({ title: 'Cancel this rewatch?', message: 'Episodes ticked during this rewatch are forgotten. Earlier play-throughs are kept.', confirmLabel: 'Cancel rewatch', danger: true }))
      act(() => api.media.cancelRewatch(media!.id!), 'Rewatch cancelled');
  }
  async function untrack() {
    if (!(await confirm.ask({ title: `Remove “${title}”?`, message: 'Deletes your status, rating, every recorded viewing, cuts and your review for this title.', confirmLabel: 'Remove', danger: true }))) return;
    try {
      await api.media.untrack(media!.id!);
      toast.success('Removed from your library');
      router.back('/library');
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  async function openHistory() {
    historyOpen = true;
    history = null;
    history = (await api.media.history(media!.id!)).events;
  }
  async function deleteEvent(ev: HistoryEvent) {
    try {
      apply(await api.media.deleteEvent(media!.id!, ev.id));
      history = history?.filter((h) => h.id !== ev.id) ?? null;
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  const saveNotes = () => act(() => api.media.notes(media!.id!, notes), 'Notes saved').then(() => (notesOpen = false));
  async function saveComment(e: Event) {
    e.preventDefault();
    commentBusy = true;
    try {
      const c = await api.media.comment(media!.id!, myComment);
      comments = [c, ...comments.filter((x) => x.user_id !== c.user_id)];
      toast.success('Review saved');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      commentBusy = false;
    }
  }
  async function deleteComment() {
    if (!(await confirm.ask({ title: 'Delete your review?', confirmLabel: 'Delete', danger: true }))) return;
    await api.media.deleteComment(media!.id!);
    comments = comments.filter((c) => c.user_id !== auth.user?.id);
    myComment = '';
  }
</script>

<div class="title-page">
  {#if error}
    <div class="page"><EmptyState title="Could not load this title" text={error}><a class="btn btn-secondary" href="/search">Back to search</a></EmptyState></div>
  {:else if !media}
    <div class="page"><div class="skeleton hero-sk"></div></div>
  {:else}
    <div class="hero" style:background-image={backdrop ? `url(${backdrop})` : undefined}>
      <div class="hero-shade"></div>
    </div>
    <div class="page over">
      <button class="back" onclick={() => router.back('/library')}><ArrowLeft size={16} /> Back</button>
      <div class="top" in:fade={{ duration: 200 }}>
        <div class="poster"><Poster path={media.poster_path} size="w500" type={media.media_type} radius="var(--radius-lg)" eager /></div>
        <div class="info">
          <div class="chips">
            <span class="pill">{#if isTv}<Tv size={11} /> Series{:else}<Film size={11} /> Movie{/if}</span>
            {#if media.tmdb_status}<span class="pill">{media.tmdb_status}</span>{/if}
            {#if t}<span class="pill pill-status status-{t.status}"><span class="dot"></span>{STATUS_LABEL[t.status]}</span>{/if}
            {#if t?.is_rewatching}<span class="pill pill-signal"><Repeat size={11} /> Rewatch #{t.active_run}</span>{/if}
            {#if badge}<span class="pill pill-{badge.tone}"><Repeat size={11} /> {badge.text} ×{t?.watch_count}</span>{/if}
            {#if t?.is_private}<span class="pill"><Lock size={11} /> Private</span>{/if}
          </div>
          <h1>{title}</h1>
          {#if media.original_title && media.original_title !== title}<p class="orig muted">{media.original_title}</p>{/if}
          <p class="meta muted">
            {#if media.release_date}<span>{year(media.release_date)}</span>{/if}
            {#if isTv && media.number_of_seasons}<span>{media.number_of_seasons} season{media.number_of_seasons === 1 ? '' : 's'}{media.number_of_episodes ? ` · ${media.number_of_episodes} episodes` : ''}</span>{/if}
            {#if media.runtime}<span><Clock size={12} /> {isTv ? `~${media.runtime} min/ep` : minutesToText(media.runtime)}</span>{/if}
            {#if media.vote_average}<span class="tm"><Star size={12} /> {media.vote_average} TMDB</span>{/if}
            {#if media.next_air_date}<span class="next"><CalendarClock size={12} /> Next episode {airsIn(media.next_air_date)}</span>{/if}
          </p>
          <div class="genres">{#each media.genres as g}<span class="pill">{g.name}</span>{/each}</div>
          <p class="overview">{media.overview || 'No overview available.'}</p>

          {#if !auth.user}
            <a class="btn btn-primary btn-lg" href="/login?next={encodeURIComponent(location.pathname)}">Sign in to track this</a>
          {:else if !t}
            <div class="addrow">
              <button class="btn btn-primary btn-lg" onclick={() => track('to_watch')} disabled={busy}>{#if busy}<Loader2 size={18} class="spin" />{:else}<Plus size={18} />{/if} Add to library</button>
              <button class="btn btn-secondary btn-lg" onclick={() => (addMenu = !addMenu)}>Add as…</button>
              {#if addMenu}
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="scrim" role="presentation" onclick={() => (addMenu = false)}></div>
                <div class="menu animate-rise">{#each STATUS_ORDER as s}<button class="mi status-{s}" onclick={() => track(s)}><span class="dot"></span>{STATUS_LABEL[s]}</button>{/each}</div>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      {#if t && media.id}
        <div class="controls card animate-rise">
          <div class="ctl">
            <span class="lbl">Status</span>
            <StatusPicker value={t.status} onchange={setStatus} disabled={busy} />
          </div>
          <div class="ctl">
            <span class="lbl">My rating</span>
            <StarRating value={t.rating} onchange={rate} size={24} />
          </div>
          <div class="ctl actions">
            {#if isTv}
              {#if t.is_rewatching}
                <button class="btn btn-sm btn-secondary" onclick={cancelRewatch} disabled={busy}><X size={14} /> Cancel rewatch</button>
              {:else if t.watch_count >= 1 && !t.active_run}
                <button class="btn btn-sm btn-secondary" onclick={rewatch} disabled={busy}><Repeat size={14} /> Rewatch</button>
              {/if}
            {:else}
              <button class="btn btn-sm btn-secondary" onclick={rewatch} disabled={busy}><Repeat size={14} /> {t.watch_count ? 'Watched again' : 'Log a viewing'}</button>
            {/if}
            <button class="btn btn-sm btn-secondary" onclick={() => (listsOpen = true)}><ListPlus size={14} /> Lists{#if view?.lists.length}{` (${view.lists.length})`}{/if}</button>
            <button class="btn btn-sm btn-ghost" onclick={() => (notesOpen = true)} title="Notes"><StickyNote size={14} /> {t.notes ? 'Notes' : 'Add note'}</button>
            <button class="btn btn-sm btn-ghost" onclick={openHistory} title="Viewing history"><History size={14} /> History</button>
            <button class="btn btn-sm btn-ghost" onclick={togglePrivacy} title={t.is_private ? 'Make visible' : 'Make private'}>{#if t.is_private}<Lock size={14} />{:else}<Unlock size={14} />{/if}</button>
            <button class="btn btn-sm btn-ghost" onclick={refresh} disabled={busy} title="Refresh from TMDB"><RefreshCw size={14} class={busy ? 'spin' : ''} /></button>
            <button class="btn btn-sm btn-ghost danger" onclick={untrack} title="Remove from library"><Trash2 size={14} /></button>
          </div>
        </div>

        {#if isTv && p}
          <div class="progress card animate-rise">
            <div class="prow">
              <div class="ptext">
                {#if p.next_episode}
                  <span class="lbl">Up next{p.season?.part_label ? ` · ${p.season.name} ${p.season.part_label}` : ''}</span>
                  <strong>{p.next_episode.code}{p.next_episode.display_number !== p.next_episode.episode_number ? ` (${p.next_episode.display_number})` : ''} · {p.next_episode.title || 'Untitled'}</strong>
                {:else if p.complete}
                  <span class="lbl">All caught up</span>
                  <strong>{p.upcoming?.air_date ? `${p.upcoming.code} airs ${airsIn(p.upcoming.air_date)}` : media.in_production ? 'Waiting for new episodes' : 'Series complete'}</strong>
                {:else}
                  <span class="lbl">Progress</span><strong>Nothing aired yet</strong>
                {/if}
                <span class="faint">{p.watched}/{p.aired} episodes{p.total > p.aired ? ` · ${p.total - p.aired} upcoming` : ''}{p.is_rewatch ? ` · play-through #${p.run}` : ''}</span>
              </div>
              {#if p.next_episode}
                <button class="btn btn-primary" onclick={markNext} disabled={busy}>{#if busy}<Loader2 size={16} class="spin" />{:else}<Play size={16} />{/if} Watched {p.next_episode.code}</button>
              {:else if t.status === 'watched' && p.unwatched_aired}
                <span class="pill pill-signal"><Sparkles size={12} /> {p.unwatched_aired} new</span>
              {/if}
            </div>
            <ProgressBar value={p.percent} tone={p.complete ? 'radar' : 'brand'} />
          </div>
        {/if}
      {/if}

      {#if isTv && (seasons.length || media.preview_seasons?.length)}
        <section class="seasons animate-rise">
          <div class="stabs">
            {#each seasons.length ? seasons : media.preview_seasons ?? [] as s (s.season_number)}
              {@const st = s as any}
              <button class="stab" data-active={season === s.season_number} onclick={() => (season = s.season_number)}>
                <span>{s.name}</span>
                {#if t && st.aired !== undefined}<span class="sc" class:done={st.watched === st.aired && st.aired > 0}>{st.watched}/{st.aired}</span>{:else}<span class="sc">{s.episode_count}</span>{/if}
              </button>
            {/each}
          </div>
          {#if currentSeason && view}
            {#key currentSeason.season_number}
              <SeasonPanel {view} season={currentSeason} onview={(v) => apply(v)} />
            {/key}
          {:else if !seasons.length}
            {@const ps = media.preview_seasons?.find((s) => s.season_number === season)}
            {#if ps}
              <div class="card card-pad muted preview">
                <strong>{ps.name}</strong> · {ps.episode_count} episodes{ps.air_date ? ` · ${dateText(ps.air_date)}` : ''}
                <p>{ps.overview || 'Add this series to your library to see and track its episodes.'}</p>
              </div>
            {/if}
          {/if}
        </section>
      {/if}

      <div class="cols">
        {#if auth.user && media.id}
          <section class="card card-pad animate-rise">
            <div class="section-head"><h2><MessageSquare size={18} /> Reviews</h2></div>
            {#if t}
              <form onsubmit={saveComment} class="cform">
                <textarea class="textarea" bind:value={myComment} maxlength="2000" placeholder="What did you think? Friends can read this."></textarea>
                <div class="crow"><span class="faint">{myComment.length} / 2000</span><div>{#if mine}<button type="button" class="btn btn-sm btn-ghost danger" onclick={deleteComment}>Delete</button>{/if}<button class="btn btn-sm btn-primary" disabled={commentBusy || !myComment.trim() || myComment === mine?.body}>{mine ? 'Update' : 'Post'}</button></div></div>
              </form>
            {/if}
            {#if others.length}
              <div class="clist">
                {#each others as c (c.id)}
                  <div class="comment"><Avatar name={c.username} size={30} /><div><div class="ch"><a class="who" href="/u/{encodeURIComponent(c.username)}">{c.username}</a><span class="faint">{relTime(c.updated_at)}</span></div><p>{c.body}</p></div></div>
                {/each}
              </div>
            {:else}
              <p class="faint">No reviews from friends yet.</p>
            {/if}
          </section>
        {/if}
        {#if view?.friends.length}
          <section class="card card-pad animate-rise">
            <div class="section-head"><h2><Users size={18} /> Friends</h2></div>
            <div class="flist">
              {#each view.friends as f (f.id)}
                <a class="friend" href="/u/{encodeURIComponent(f.username)}"><Avatar name={f.username} size={28} /><span class="truncate">{f.username}</span><span class="pill pill-status status-{f.status}">{STATUS_LABEL[f.status]}</span>{#if f.rating}<span class="faint">★ {f.rating / 2}</span>{/if}</a>
              {/each}
            </div>
          </section>
        {/if}
        <section class="card card-pad animate-rise ext">
          <a class="link" href="https://www.themoviedb.org/{media.media_type}/{media.tmdb_id}" target="_blank" rel="noopener">View on TMDB <ExternalLink size={13} /></a>
          {#if media.tmdb_synced_at}<span class="faint">Synced {relTime(media.tmdb_synced_at)}</span>{/if}
        </section>
      </div>
    </div>
  {/if}
</div>

{#if media?.id}
  <ListPicker bind:open={listsOpen} mediaId={media.id} onchange={() => api.media.get(media!.id!).then((v) => apply(v)).catch(() => {})} />
{/if}

<Modal bind:open={notesOpen} title="Notes" size="sm">
  <textarea class="textarea" bind:value={notes} maxlength="4000" placeholder="Private notes, only you can see them."></textarea>
  {#snippet footer()}<button class="btn btn-secondary" onclick={() => (notesOpen = false)}>Cancel</button><button class="btn btn-primary" onclick={saveNotes}>Save</button>{/snippet}
</Modal>

<Modal bind:open={historyOpen} title="Viewing history" size="md">
  {#if history === null}<div class="skeleton hsk"></div>
  {:else if !history.length}<p class="faint">No viewings recorded yet.</p>
  {:else}
    <div class="hlist">
      {#each history as ev (ev.id)}
        <div class="hrow">
          <span class="hcode">{#if ev.season_number != null}S{ev.season_number}E{ev.episode_number}{:else}<Film size={13} />{/if}</span>
          <span class="htitle truncate">{ev.episode_title || (ev.season_number == null ? `Viewing #${ev.run}` : `Episode ${ev.episode_number}`)}</span>
          <span class="faint">{ev.run ? `#${ev.run}` : 'extra'}</span>
          <span class="faint hdate">{dateText(ev.watched_at)}</span>
          <button class="icon-btn icon-btn-sm" onclick={() => deleteEvent(ev)} aria-label="Delete viewing"><Trash2 size={13} /></button>
        </div>
      {/each}
    </div>
  {/if}
</Modal>

<style>
  .title-page { position: relative; }
  .hero { position: absolute; left: 0; right: 0; top: 0; height: 26rem; background: rgb(var(--c-subtle)) center 20% / cover no-repeat; }
  .hero-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgb(var(--c-page) / 0.35) 0%, rgb(var(--c-page) / 0.75) 55%, rgb(var(--c-page)) 100%); backdrop-filter: blur(2px); }
  .over { position: relative; }
  .hero-sk { height: 22rem; border-radius: var(--radius-lg); }
  .back { display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 600; color: rgb(var(--c-text-2)); margin-bottom: 1rem; }
  .back:hover { color: rgb(var(--c-text-1)); }
  .top { display: flex; gap: 1.5rem; align-items: flex-start; margin-bottom: 1.25rem; }
  .poster { width: 9rem; flex-shrink: 0; box-shadow: var(--shadow-lg); border-radius: var(--radius-lg); }
  @media (min-width: 640px) { .poster { width: 13rem; } }
  .info { flex: 1; min-width: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
  h1 { font-size: 1.625rem; letter-spacing: -0.02em; }
  @media (min-width: 640px) { h1 { font-size: 2.125rem; } }
  .orig { margin-top: 0.15rem; }
  .meta { display: flex; flex-wrap: wrap; gap: 0.35rem 0.875rem; margin: 0.5rem 0; font-size: 0.8125rem; }
  .meta span { display: inline-flex; align-items: center; gap: 0.3rem; }
  .tm { color: rgb(var(--c-signal)); font-weight: 600; }
  .next { color: rgb(var(--c-brand)); font-weight: 600; }
  .genres { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.75rem; }
  .overview { max-width: 60ch; line-height: 1.6; margin-bottom: 1rem; }
  .top { position: relative; z-index: 2; }
  .addrow { position: relative; display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .scrim { position: fixed; inset: 0; z-index: 20; }
  .menu { position: absolute; top: calc(100% + 0.3rem); left: 0; z-index: 21; background: rgb(var(--c-raised)); border: 1px solid rgb(var(--c-border)); border-radius: var(--radius-md); box-shadow: var(--shadow-pop); padding: 0.3rem; min-width: 12rem; }
  .mi { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.55rem 0.7rem; border-radius: 0.45rem; font-weight: 600; text-align: left; }
  .mi:hover { background: rgb(var(--c-subtle)); }
  .controls { display: flex; flex-wrap: wrap; gap: 1rem 2rem; padding: 1rem 1.25rem; margin-bottom: 1rem; }
  .ctl { display: flex; flex-direction: column; gap: 0.4rem; }
  .lbl { font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgb(var(--c-text-3)); }
  .actions { flex-direction: row; flex-wrap: wrap; align-items: flex-end; gap: 0.35rem; margin-left: auto; }
  .danger:hover { color: rgb(var(--c-danger)); }
  .progress { padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .prow { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .ptext { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
  .ptext strong { font-size: 1rem; }
  .seasons { margin-bottom: 1.25rem; }
  .stabs { display: flex; gap: 0.35rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 0.5rem; scrollbar-width: none; }
  .stabs::-webkit-scrollbar { display: none; }
  .stab { display: inline-flex; align-items: center; gap: 0.5rem; height: 2.25rem; padding: 0 0.875rem; border-radius: 999px; background: rgb(var(--c-surface)); border: 1px solid rgb(var(--c-border)); font-weight: 600; white-space: nowrap; color: rgb(var(--c-text-2)); transition: all var(--dur-2) var(--ease-spring); }
  .stab:hover { transform: translateY(-1px); color: rgb(var(--c-text-1)); }
  .stab[data-active='true'] { background: rgb(var(--c-brand)); border-color: rgb(var(--c-brand)); color: rgb(var(--c-on-brand)); }
  .sc { font-size: 0.6875rem; padding: 0.05rem 0.4rem; border-radius: 999px; background: rgb(var(--c-subtle)); color: rgb(var(--c-text-3)); }
  .stab[data-active='true'] .sc { background: rgb(255 255 255 / 0.25); color: inherit; }
  .sc.done { background: rgb(var(--c-success) / 0.15); color: rgb(var(--c-success)); }
  .preview p { margin-top: 0.5rem; }
  .cols { display: grid; grid-template-columns: 1fr; gap: 1rem; }
  @media (min-width: 900px) { .cols { grid-template-columns: 2fr 1fr; } .ext { grid-column: 1 / -1; } }
  .cform { margin-bottom: 1rem; }
  .crow { display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; font-size: 0.75rem; }
  .crow div { display: flex; gap: 0.35rem; }
  .clist { display: flex; flex-direction: column; gap: 0.75rem; }
  .comment { display: flex; gap: 0.625rem; }
  .ch { display: flex; gap: 0.5rem; align-items: baseline; font-size: 0.8125rem; }
  .who { font-weight: 700; }
  .comment p { white-space: pre-line; font-size: 0.875rem; margin-top: 0.15rem; }
  .flist { display: flex; flex-direction: column; gap: 0.35rem; }
  .friend { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem; border-radius: var(--radius-sm); font-weight: 600; }
  .friend:hover { background: rgb(var(--c-subtle)); }
  .friend .truncate { flex: 1; }
  .ext { display: flex; justify-content: space-between; align-items: center; gap: 1rem; font-size: 0.8125rem; }
  .ext .link { display: inline-flex; align-items: center; gap: 0.3rem; }
  .hsk { height: 8rem; }
  .hlist { display: flex; flex-direction: column; gap: 0.25rem; }
  .hrow { display: flex; align-items: center; gap: 0.625rem; padding: 0.4rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.8125rem; }
  .hrow:hover { background: rgb(var(--c-subtle)); }
  .hcode { font-weight: 700; color: rgb(var(--c-brand)); min-width: 3.25rem; display: inline-flex; }
  .htitle { flex: 1; }
  .hdate { font-size: 0.75rem; }
</style>
