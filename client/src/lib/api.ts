// Typed API client. Cookie sessions + a custom header the server requires on writes (CSRF).
export type MediaType = 'tv' | 'movie';
export type Status = 'watching' | 'to_watch' | 'watched' | 'on_hold' | 'dropped';
export type Privacy = 'public' | 'friends_only' | 'users_only' | 'private';
export type TitleLanguage = 'en' | 'original' | 'ja';

export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  profile_privacy: Privacy;
  title_language: TitleLanguage;
  auto_remove_from_lists: boolean;
  auto_resume: boolean;
  created_at: string;
}
export interface Me {
  user: User;
  unread_notifications: number;
  pending_requests: number;
  registration_open: boolean;
}
export interface Genre {
  id: number;
  name: string;
}
export interface Media {
  id: number | null;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  original_language: string | null;
  alternative_titles: { iso_3166_1: string; title: string }[];
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  runtime: number | null;
  genres: Genre[];
  tmdb_status: string | null;
  in_production: boolean;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  next_air_date: string | null;
  last_air_date: string | null;
  vote_average: number | null;
  tmdb_synced_at: string | null;
  preview_seasons?: SeasonMeta[];
}
export type MediaLite = Pick<Media, 'id' | 'tmdb_id' | 'media_type' | 'title' | 'original_title' | 'original_language' | 'alternative_titles' | 'poster_path'> &
  Partial<Media>;
export interface Tracking {
  id: number;
  status: Status;
  rating: number | null;
  is_private: boolean;
  watch_count: number;
  active_run: number | null;
  is_rewatching: boolean;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface EpisodeRef {
  season_number: number;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  runtime?: number | null;
  code: string;
  display_number?: number;
}
export interface Progress {
  run: number | null;
  is_rewatch: boolean;
  total: number;
  aired: number;
  watched: number;
  percent: number;
  complete: boolean;
  unwatched_aired: number;
  next_episode: EpisodeRef | null;
  upcoming: EpisodeRef | null;
  season: {
    number: number;
    name: string;
    part_label: string | null;
    part_index: number;
    parts: number;
    total: number;
    aired: number;
    watched: number;
  } | null;
}
export interface SeasonMeta {
  season_number: number;
  name: string;
  overview: string | null;
  poster_path: string | null;
  air_date: string | null;
  episode_count: number;
}
export interface SeasonPart {
  index: number;
  start: number;
  end: number;
  label: string | null;
  total: number;
  aired: number;
  watched: number;
}
export interface SeasonState extends SeasonMeta {
  aired: number;
  watched: number;
  parts: SeasonPart[];
  cuts: Cut[];
}
export interface Cut {
  id: number;
  season_number: number;
  after_episode: number;
}
export interface EpisodeState {
  season_number: number;
  episode_number: number;
  tmdb_id: number | null;
  title: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  aired: boolean;
  watched: boolean;
  play_count: number;
  last_watched_at: string | null;
  part_index: number;
  part_label: string | null;
  display_number: number;
}
export interface FriendTracking {
  id: number;
  username: string;
  status: Status;
  rating: number | null;
  watch_count: number;
}
export interface TitleView {
  media: Media;
  tracking: Tracking | null;
  progress: Progress | null;
  seasons: SeasonState[];
  cuts: Cut[];
  lists: { id: number; name: string }[];
  friends: FriendTracking[];
  completed?: boolean;
  marked?: number;
  diff?: { newSeasons: number[]; newEpisodes: unknown[]; removedEpisodes: number };
}
export interface LibraryItem {
  media: Media;
  tracking: Tracking;
  progress?: Progress | null;
}
export interface Paged<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
  limit?: number;
}
export type Counts = Record<Status, number> & { all: number };
export interface UpcomingEpisode {
  season_number: number;
  episode_number: number;
  episode_title: string | null;
  air_date: string;
  media_id: number;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  media_type: MediaType;
  original_title: string | null;
  original_language: string | null;
  alternative_titles: string | null;
}
export interface HomeData {
  continue_watching: LibraryItem[];
  caught_up: LibraryItem[];
  new_episodes: LibraryItem[];
  upcoming: UpcomingEpisode[];
  aired_today: UpcomingEpisode[];
  planned: LibraryItem[];
  recently_completed: LibraryItem[];
  counts: Counts;
}
export interface SearchResult {
  type: MediaType;
  tmdb_id: number;
  media_id: number | null;
  title: string;
  original_title: string | null;
  original_language: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  genre_ids: number[];
  tracking: Tracking | null;
}
export interface ListSummary {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
  posters: string[];
}
export interface ListItem {
  media: Media;
  tracking: Tracking | null;
  position: number;
  added_at: string;
}
export interface Comment {
  id: number;
  user_id: number;
  username: string;
  body: string;
  created_at: string;
  updated_at: string;
}
export interface HistoryEvent {
  id: number;
  season_number: number | null;
  episode_number: number | null;
  run: number | null;
  watched_at: string;
  episode_title: string | null;
}
export interface Activity {
  id: number;
  type: string;
  details: Record<string, any> | null;
  created_at: string;
  user: { id: number; username: string };
  media: MediaLite | null;
  list: { id: number; name: string } | null;
}
export interface Notification {
  id: number;
  type: 'new_season' | 'new_episodes' | string;
  payload: Record<string, any>;
  read: boolean;
  created_at: string;
  media: MediaLite | null;
}
export interface Achievement {
  id: number | string;
  name: string;
  description: string;
  icon: string;
  tier: number;
}
export interface Stats {
  counts: Record<string, number> & { completed_tv: number; completed_movies: number; completed_total: number; rewatched: number; rated: number };
  episodes_watched: number;
  movie_viewings: number;
  minutes: { total: number; tv: number; movies: number };
  average_rating: number | null;
  rating_distribution: { rating: number; count: number }[];
  genres: { name: string; count: number; percentage: number }[];
  decades: { decade: number; count: number }[];
  activity: { month: string; count: number }[];
  weekdays: number[];
  most_rewatched: (MediaLite & { watch_count: number })[];
  top_rated: (MediaLite & { rating: number })[];
  achievements: Achievement[];
  friends: number;
}
export type Friendship = 'self' | 'none' | 'accepted' | 'pending_them' | 'pending_me';
export interface ProfileCard {
  media: MediaLite & { release_date: string | null };
  tracking: { rating: number | null; watch_count: number; status: Status };
  at: string;
}
export interface Profile {
  user: { id: number; username: string; created_at: string; profile_privacy?: Privacy };
  is_owner: boolean;
  access: 'public' | 'private' | 'login_required' | 'friends_only';
  friendship: Friendship | null;
  stats?: { completed_tv: number; completed_movies: number; episodes: number; minutes: number; rated: number; friends: number; rewatched: number };
  achievements?: Achievement[];
  genres?: { name: string; count: number; percentage: number }[];
  recent?: ProfileCard[];
  watching?: ProfileCard[];
  favorites?: ProfileCard[];
}
export interface FriendsData {
  friends: { id: number; username: string; since: string }[];
  incoming: { id: number; username: string; created_at: string }[];
  outgoing: { id: number; username: string; created_at: string }[];
}
export interface ImportItem {
  source: 'mal' | 'watcharr';
  name: string;
  type: MediaType;
  status: Status;
  rating: number | null;
  tmdb_id?: number | null;
  external_id?: number | null;
  rewatch_count?: number;
  rewatching?: boolean;
  watched_episodes?: number;
  watched_episodes_list?: unknown[] | null;
}
export interface ImportChoice {
  type: MediaType;
  tmdb_id: number;
  title: string;
  year: string;
  poster_path: string | null;
}
export interface ImportResult {
  result: 'imported' | 'exists' | 'not_found' | 'choices' | 'rate_limited';
  media?: { id: number; title: string; media_type: MediaType; tmdb_id: number; poster_path: string | null };
  choices?: ImportChoice[];
  retry_after?: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

async function call<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'WatchRadar', ...(init.headers as Record<string, string>) };
  let body = init.body;
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url, { ...init, headers, body, credentials: 'same-origin' });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/api/auth/login')) onUnauthorized?.();
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`, data?.retry_after);
  }
  return data as T;
}

const qs = (params: Record<string, unknown>) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
};

export const api = {
  auth: {
    config: () => call<{ registration_open: boolean; first_run: boolean; tmdb_configured: boolean }>('/api/auth/config'),
    me: () => call<Me>('/api/auth/me'),
    login: (login: string, password: string) => call<Me>('/api/auth/login', { method: 'POST', json: { login, password } }),
    register: (username: string, email: string, password: string) => call<Me>('/api/auth/register', { method: 'POST', json: { username, email, password } }),
    logout: () => call<void>('/api/auth/logout', { method: 'POST' }),
    logoutAll: () => call<void>('/api/auth/logout-all', { method: 'POST' }),
    update: (patch: Partial<Pick<User, 'profile_privacy' | 'title_language' | 'auto_remove_from_lists' | 'auto_resume' | 'email'>>) =>
      call<Me>('/api/auth/me', { method: 'PATCH', json: patch }),
    password: (current: string, next: string) => call<{ ok: true }>('/api/auth/password', { method: 'POST', json: { current, next } }),
    deleteAccount: (password: string) => call<void>('/api/auth/me', { method: 'DELETE', json: { password } }),
  },
  tmdb: {
    search: (q: string, page = 1, type?: MediaType | '') => call<Paged<SearchResult> & { results: SearchResult[] }>(`/api/tmdb/search${qs({ q, page, type })}`),
    trending: (window: 'day' | 'week' = 'week') => call<{ results: SearchResult[] }>(`/api/tmdb/trending${qs({ window })}`),
  },
  titles: {
    get: (type: MediaType, tmdbId: number) => call<TitleView>(`/api/titles/${type}/${tmdbId}`),
    comments: (type: MediaType, tmdbId: number) => call<{ comments: Comment[] }>(`/api/titles/${type}/${tmdbId}/comments`),
    track: (type: MediaType, tmdbId: number, body: { status?: Status; list_id?: number; watched_at?: string } = {}) =>
      call<TitleView>(`/api/titles/${type}/${tmdbId}/track`, { method: 'POST', json: body }),
  },
  media: {
    get: (id: number) => call<TitleView>(`/api/media/${id}`),
    untrack: (id: number) => call<void>(`/api/media/${id}`, { method: 'DELETE' }),
    status: (id: number, status: Status, watched_at?: string) => call<TitleView>(`/api/media/${id}/status`, { method: 'PATCH', json: { status, watched_at } }),
    rating: (id: number, rating: number | null) => call<TitleView>(`/api/media/${id}/rating`, { method: 'PATCH', json: { rating } }),
    privacy: (id: number, is_private: boolean) => call<TitleView>(`/api/media/${id}/privacy`, { method: 'PATCH', json: { is_private } }),
    notes: (id: number, notes: string) => call<TitleView>(`/api/media/${id}/notes`, { method: 'PATCH', json: { notes } }),
    refresh: (id: number) => call<TitleView>(`/api/media/${id}/refresh`, { method: 'POST' }),
    season: (id: number, n: number) => call<{ episodes: EpisodeState[] }>(`/api/media/${id}/seasons/${n}`),
    episode: (id: number, season: number, episode: number, watched: boolean, watched_at?: string) =>
      call<TitleView>(`/api/media/${id}/episodes`, { method: 'POST', json: { season, episode, watched, watched_at } }),
    mark: (id: number, body: { season: number; episode?: number; mode: 'up_to' | 'season'; watched_at?: string }) =>
      call<TitleView>(`/api/media/${id}/episodes/mark`, { method: 'POST', json: body }),
    unmarkSeason: (id: number, season: number) => call<TitleView>(`/api/media/${id}/episodes/unmark`, { method: 'POST', json: { season } }),
    rewatchEpisode: (id: number, season: number, episode: number, undo = false) =>
      call<{ play_count: number }>(`/api/media/${id}/episodes/rewatch`, { method: 'POST', json: { season, episode, undo } }),
    startRewatch: (id: number, watched_at?: string) => call<TitleView>(`/api/media/${id}/rewatch`, { method: 'POST', json: { watched_at } }),
    cancelRewatch: (id: number) => call<TitleView>(`/api/media/${id}/rewatch`, { method: 'DELETE' }),
    history: (id: number) => call<{ events: HistoryEvent[] }>(`/api/media/${id}/history`),
    deleteEvent: (id: number, eventId: number) => call<TitleView>(`/api/media/${id}/history/${eventId}`, { method: 'DELETE' }),
    addCut: (id: number, season: number, after: number) => call<TitleView>(`/api/media/${id}/cuts`, { method: 'POST', json: { season, after } }),
    removeCut: (id: number, cutId: number) => call<TitleView>(`/api/media/${id}/cuts/${cutId}`, { method: 'DELETE' }),
    comment: (id: number, body: string) => call<Comment>(`/api/media/${id}/comment`, { method: 'PUT', json: { body } }),
    deleteComment: (id: number) => call<void>(`/api/media/${id}/comment`, { method: 'DELETE' }),
  },
  library: {
    list: (params: Record<string, unknown>) => call<Paged<LibraryItem> & { counts: Counts }>(`/api/library${qs(params)}`),
    home: () => call<HomeData>('/api/library/home'),
    counts: () => call<Counts>('/api/library/counts'),
    genres: () => call<{ genres: string[] }>('/api/library/genres'),
    exportUrl: '/api/library/export',
  },
  lists: {
    all: () => call<{ lists: ListSummary[] }>('/api/lists'),
    create: (name: string, description?: string) => call<ListSummary>('/api/lists', { method: 'POST', json: { name, description } }),
    get: (id: number, params: Record<string, unknown> = {}) => call<Paged<ListItem> & { list: ListSummary }>(`/api/lists/${id}${qs(params)}`),
    update: (id: number, patch: { name?: string; description?: string }) => call<ListSummary>(`/api/lists/${id}`, { method: 'PATCH', json: patch }),
    remove: (id: number) => call<void>(`/api/lists/${id}`, { method: 'DELETE' }),
    addItem: (id: number, body: { media_id?: number; tmdb_id?: number; type?: MediaType }) => call<ListSummary>(`/api/lists/${id}/items`, { method: 'POST', json: body }),
    removeItem: (id: number, mediaId: number) => call<void>(`/api/lists/${id}/items/${mediaId}`, { method: 'DELETE' }),
    reorder: (id: number, media_ids: number[]) => call<{ ok: true }>(`/api/lists/${id}/order`, { method: 'PUT', json: { media_ids } }),
    forMedia: (mediaId: number) => call<{ lists: { id: number; name: string; has: boolean }[] }>(`/api/lists/for/${mediaId}`),
  },
  social: {
    friends: () => call<FriendsData>('/api/friends'),
    request: (userId: number) => call<{ status: Friendship }>(`/api/friends/request/${userId}`, { method: 'POST' }),
    accept: (userId: number) => call<{ status: Friendship }>(`/api/friends/accept/${userId}`, { method: 'POST' }),
    remove: (userId: number) => call<{ status: Friendship }>(`/api/friends/${userId}`, { method: 'DELETE' }),
    searchUsers: (q: string) => call<{ users: { id: number; username: string; friendship: Friendship }[] }>(`/api/users/search${qs({ q })}`),
    feed: (page = 1, scope: 'friends' | 'me' | 'all' = 'friends') => call<Paged<Activity> & { scope: string }>(`/api/feed${qs({ page, scope })}`),
    profile: (username: string) => call<Profile>(`/api/users/${encodeURIComponent(username)}`),
    profileLibrary: (username: string, params: Record<string, unknown>) =>
      call<Paged<LibraryItem> & { user: { id: number; username: string } }>(`/api/users/${encodeURIComponent(username)}/library${qs(params)}`),
  },
  stats: () => call<Stats>('/api/stats'),
  achievements: () => call<{ achievements: Achievement[] }>('/api/achievements'),
  notifications: {
    list: (page = 1, unread = false) => call<Paged<Notification> & { unread: number }>(`/api/notifications${qs({ page, unread: unread ? 1 : '' })}`),
    read: (ids?: number[]) => call<{ unread: number }>('/api/notifications/read', { method: 'POST', json: { ids } }),
    remove: (id: number) => call<void>(`/api/notifications/${id}`, { method: 'DELETE' }),
    clear: () => call<void>('/api/notifications', { method: 'DELETE' }),
  },
  import: {
    parse: (format: 'mal' | 'watcharr', content: string) => call<{ items: ImportItem[] }>('/api/import/parse', { method: 'POST', json: { format, content } }),
    item: (item: ImportItem, resolved?: { type: MediaType; tmdb_id: number }) => call<ImportResult>('/api/import/item', { method: 'POST', json: { item, resolved } }),
  },
  admin: {
    overview: () => call<{ users: number; titles: number; tracked: number; events: number; scheduler: any; legacy_import: any }>('/api/admin/overview'),
    users: (page = 1) => call<{ users: any[]; total: number; page: number; pages: number }>(`/api/admin/users${qs({ page })}`),
    setAdmin: (id: number, is_admin: boolean) => call<{ ok: true }>(`/api/admin/users/${id}`, { method: 'PATCH', json: { is_admin } }),
    deleteUser: (id: number) => call<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),
    runScheduler: (force = false) => call<any>('/api/admin/scheduler/run', { method: 'POST', json: { force } }),
  },
};
