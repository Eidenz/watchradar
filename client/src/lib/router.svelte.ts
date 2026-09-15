// Tiny history router with path params. Links are plain <a href> elements; App.svelte
// intercepts same-origin clicks and calls router.go().
export type Route =
  | { page: 'home' }
  | { page: 'login' }
  | { page: 'register' }
  | { page: 'library'; status: string }
  | { page: 'search' }
  | { page: 'title'; type: 'tv' | 'movie'; tmdbId: number }
  | { page: 'lists' }
  | { page: 'list'; id: number }
  | { page: 'feed' }
  | { page: 'friends' }
  | { page: 'profile'; username: string }
  | { page: 'profile-library'; username: string }
  | { page: 'stats' }
  | { page: 'settings'; tab: string }
  | { page: 'notifications' }
  | { page: 'admin' }
  | { page: 'missing' };

function parse(pathname = location.pathname): Route {
  const p = pathname.replace(/\/+$/, '') || '/';
  let m: RegExpMatchArray | null;
  if (p === '/') return { page: 'home' };
  if (p === '/login') return { page: 'login' };
  if (p === '/register') return { page: 'register' };
  if ((m = p.match(/^\/library(?:\/(watching|to_watch|watched|on_hold|dropped|all))?$/))) return { page: 'library', status: m[1] || 'all' };
  if (p === '/search') return { page: 'search' };
  if ((m = p.match(/^\/title\/(tv|movie)\/(\d+)$/))) return { page: 'title', type: m[1] as 'tv' | 'movie', tmdbId: Number(m[2]) };
  if (p === '/lists') return { page: 'lists' };
  if ((m = p.match(/^\/lists\/(\d+)$/))) return { page: 'list', id: Number(m[1]) };
  if (p === '/feed') return { page: 'feed' };
  if (p === '/friends') return { page: 'friends' };
  if ((m = p.match(/^\/u\/([^/]+)\/library$/))) return { page: 'profile-library', username: decodeURIComponent(m[1]) };
  if ((m = p.match(/^\/u\/([^/]+)$/))) return { page: 'profile', username: decodeURIComponent(m[1]) };
  if (p === '/stats') return { page: 'stats' };
  if ((m = p.match(/^\/settings(?:\/([a-z]+))?$/))) return { page: 'settings', tab: m[1] || 'account' };
  if (p === '/notifications') return { page: 'notifications' };
  if (p === '/admin') return { page: 'admin' };
  return { page: 'missing' };
}

class Router {
  current = $state<Route>(parse());
  path = $state(location.pathname);
  search = $state(location.search);

  constructor() {
    window.addEventListener('popstate', () => this.sync());
  }

  private sync() {
    this.current = parse();
    this.path = location.pathname;
    this.search = location.search;
  }

  go(path: string, { replace = false, scroll = true } = {}) {
    if (path === location.pathname + location.search && !replace) return;
    if (replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
    this.sync();
    if (scroll) window.scrollTo({ top: 0 });
  }

  /** Update only the query string (no scroll, replaces history). */
  setQuery(params: Record<string, string | number | undefined | null>) {
    const u = new URL(location.href);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') u.searchParams.delete(k);
      else u.searchParams.set(k, String(v));
    }
    history.replaceState(null, '', u.pathname + u.search);
    this.sync();
  }

  get query() {
    return new URLSearchParams(this.search);
  }

  back(fallback = '/') {
    if (history.length > 1) history.back();
    else this.go(fallback);
  }
}

export const router = new Router();
export const titleHref = (m: { media_type: 'tv' | 'movie'; tmdb_id: number }) => `/title/${m.media_type}/${m.tmdb_id}`;
