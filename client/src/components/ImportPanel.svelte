<script lang="ts">
  // MyAnimeList / Watcharr import: parse on the server, then resolve + apply items one by one.
  import { Upload, Loader2, Check, AlertTriangle, HelpCircle, Pause, X, Play } from '@lucide/svelte';
  import { api, type ImportItem, type ImportChoice, type ImportResult } from '../lib/api';
  import { toast } from '../lib/toast.svelte';
  import { img } from '../lib/format';

  type Row = { item: ImportItem; state: 'pending' | 'working' | 'imported' | 'exists' | 'not_found' | 'choices' | 'failed'; choices?: ImportChoice[]; media?: ImportResult['media']; error?: string };
  let rows = $state<Row[]>([]);
  let format = $state<'mal' | 'watcharr' | null>(null);
  let running = $state(false);
  let paused = $state(false);
  let pauseUntil = $state(0);
  let index = $state(0);
  let stop = false;

  async function pick(e: Event, f: 'mal' | 'watcharr') {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const r = await api.import.parse(f, content);
      rows = r.items.map((item) => ({ item, state: 'pending' }));
      format = f;
      index = 0;
      toast.success(`${rows.length} entries found`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      (e.target as HTMLInputElement).value = '';
    }
  }
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function processRow(row: Row, resolved?: { type: 'tv' | 'movie'; tmdb_id: number }) {
    row.state = 'working';
    for (;;) {
      try {
        const r = await api.import.item(row.item, resolved);
        if (r.result === 'rate_limited') {
          paused = true;
          pauseUntil = Date.now() + (r.retry_after || 5) * 1000;
          await sleep((r.retry_after || 5) * 1000);
          paused = false;
          continue;
        }
        row.state = r.result;
        row.choices = r.choices;
        row.media = r.media;
      } catch (e: any) {
        row.state = 'failed';
        row.error = e.message;
      }
      return;
    }
  }
  async function start() {
    running = true;
    stop = false;
    for (; index < rows.length; index++) {
      if (stop) break;
      const row = rows[index];
      if (row.state !== 'pending') continue;
      await processRow(row);
      await sleep(120);
    }
    running = false;
  }
  const counts = $derived({
    imported: rows.filter((r) => r.state === 'imported').length,
    exists: rows.filter((r) => r.state === 'exists').length,
    choices: rows.filter((r) => r.state === 'choices').length,
    not_found: rows.filter((r) => r.state === 'not_found' || r.state === 'failed').length,
    done: rows.filter((r) => r.state !== 'pending' && r.state !== 'working').length,
  });
</script>

<div class="imp">
  <div class="sources">
    <label class="src card">
      <input type="file" accept=".xml,text/xml,application/xml" onchange={(e) => pick(e, 'mal')} hidden />
      <span class="badge mal">MAL</span><div><b>MyAnimeList</b><span class="faint">XML export</span></div><Upload size={16} />
    </label>
    <label class="src card">
      <input type="file" accept=".json,application/json" onchange={(e) => pick(e, 'watcharr')} hidden />
      <span class="badge wa">W</span><div><b>Watcharr</b><span class="faint">JSON export</span></div><Upload size={16} />
    </label>
  </div>

  {#if rows.length}
    <div class="status card">
      <div class="head">
        <div><b>{format === 'mal' ? 'MyAnimeList' : 'Watcharr'}</b> · {counts.done}/{rows.length} processed</div>
        <div class="acts">
          {#if running}<button class="btn btn-sm btn-secondary" onclick={() => (stop = true)}><Pause size={14} /> Pause</button>
          {:else if counts.done < rows.length}<button class="btn btn-sm btn-primary" onclick={start}><Play size={14} /> {index ? 'Resume' : 'Start import'}</button>{/if}
          {#if !running}<button class="btn btn-sm btn-ghost" onclick={() => { rows = []; index = 0; }}><X size={14} /> Clear</button>{/if}
        </div>
      </div>
      <div class="bar"><div style:width="{(counts.done / rows.length) * 100}%"></div></div>
      <div class="sum faint">
        <span><Check size={12} /> {counts.imported} imported</span><span>{counts.exists} already tracked</span><span><HelpCircle size={12} /> {counts.choices} need a pick</span><span><AlertTriangle size={12} /> {counts.not_found} not found</span>
        {#if paused}<span class="warn">TMDB rate limit — resuming in {Math.max(0, Math.ceil((pauseUntil - Date.now()) / 1000))}s</span>{/if}
      </div>
      <div class="rows">
        {#each rows as row, i (i)}
          <div class="row st-{row.state}">
            <span class="ic">
              {#if row.state === 'working'}<Loader2 size={14} class="spin" />{:else if row.state === 'imported'}<Check size={14} />{:else if row.state === 'exists'}<Check size={14} />{:else if row.state === 'choices'}<HelpCircle size={14} />{:else if row.state === 'not_found' || row.state === 'failed'}<AlertTriangle size={14} />{:else}·{/if}
            </span>
            <span class="name truncate">{row.item.name}</span>
            <span class="faint small">{row.item.type} · {row.item.status.replace('_', ' ')}{row.item.rating ? ` · ${row.item.rating}/10` : ''}</span>
            <span class="faint small res">{row.state === 'imported' ? 'imported' : row.state === 'exists' ? 'already tracked' : row.state === 'not_found' ? 'not found' : row.state === 'failed' ? row.error : row.state === 'choices' ? 'pick a match' : ''}</span>
            {#if row.state === 'choices' && row.choices}
              <div class="choices">
                {#each row.choices as c}
                  <button class="choice" onclick={() => processRow(row, { type: c.type, tmdb_id: c.tmdb_id })}>
                    <span class="cp" style:background-image={img(c.poster_path, 'w92') ? `url(${img(c.poster_path, 'w92')})` : undefined}></span>
                    <span class="truncate">{c.title}</span><span class="faint">{c.year} · {c.type}</span>
                  </button>
                {/each}
                <button class="btn btn-xs btn-ghost" onclick={() => (row.state = 'not_found')}>Skip</button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .sources { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.625rem; }
  .src { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 0.875rem; cursor: pointer; transition: transform var(--dur-2) var(--ease-spring), box-shadow var(--dur-2); }
  .src:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
  .src div { flex: 1; display: flex; flex-direction: column; line-height: 1.25; }
  .badge { width: 2.25rem; height: 2.25rem; border-radius: 0.5rem; display: grid; place-items: center; color: #fff; font-weight: 800; font-size: 0.75rem; }
  .mal { background: #2e51a2; } .wa { background: #6d4aff; }
  .status { margin-top: 0.875rem; padding: 0.875rem 1rem; }
  .head { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .acts { display: flex; gap: 0.35rem; }
  .bar { height: 0.5rem; background: rgb(var(--c-subtle)); border-radius: 999px; overflow: hidden; }
  .bar div { height: 100%; background: rgb(var(--c-brand)); transition: width var(--dur-3); }
  .sum { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.75rem; margin: 0.5rem 0 0.75rem; }
  .sum span { display: inline-flex; align-items: center; gap: 0.25rem; }
  .warn { color: rgb(var(--c-warning)); font-weight: 600; }
  .rows { max-height: 24rem; overflow-y: auto; display: flex; flex-direction: column; gap: 0.15rem; }
  .row { display: grid; grid-template-columns: 1.25rem minmax(0, 1fr) auto auto; gap: 0.5rem; align-items: center; padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.8125rem; }
  .row:hover { background: rgb(var(--c-subtle)); }
  .ic { display: grid; place-items: center; color: rgb(var(--c-text-3)); }
  .st-imported .ic { color: rgb(var(--c-success)); } .st-exists .ic { color: rgb(var(--c-info)); } .st-choices .ic { color: rgb(var(--c-warning)); } .st-not_found .ic, .st-failed .ic { color: rgb(var(--c-danger)); } .st-working .ic { color: rgb(var(--c-brand)); }
  .name { font-weight: 600; }
  .small { font-size: 0.75rem; }
  .res { text-align: right; }
  .choices { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0.25rem 0 0.35rem 1.75rem; }
  .choice { display: inline-flex; align-items: center; gap: 0.4rem; height: 2rem; padding: 0 0.6rem 0 0.25rem; border-radius: 999px; background: rgb(var(--c-surface)); border: 1px solid rgb(var(--c-border)); font-size: 0.75rem; font-weight: 600; max-width: 18rem; }
  .choice:hover { border-color: rgb(var(--c-brand)); }
  .cp { width: 1.5rem; height: 1.5rem; border-radius: 999px; background: rgb(var(--c-subtle)) center / cover; flex-shrink: 0; }
</style>
