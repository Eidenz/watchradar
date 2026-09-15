import type { MediaLite, Status, TitleLanguage } from './api';

const LANG_TO_COUNTRY: Record<string, string> = { ja: 'JP', en: 'US', ko: 'KR', fr: 'FR', de: 'DE', es: 'ES', zh: 'CN' };

export function preferredTitle(m: Partial<MediaLite> | null | undefined, lang: TitleLanguage = 'en'): string {
  if (!m) return '';
  if (lang === 'original') return m.original_title || m.title || '';
  if (lang === 'en') return m.title || '';
  let alts: any = m.alternative_titles;
  if (typeof alts === 'string') {
    try {
      alts = JSON.parse(alts);
    } catch {
      alts = [];
    }
  }
  const country = LANG_TO_COUNTRY[lang];
  if (Array.isArray(alts) && country) {
    const hit = alts.find((t: any) => t.iso_3166_1 === country && t.title);
    if (hit) return hit.title;
  }
  if (m.original_language === lang) return m.original_title || m.title || '';
  return m.title || '';
}

export const IMG = 'https://image.tmdb.org/t/p';
export const img = (path: string | null | undefined, size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' | 'w1280' | 'original' = 'w342') =>
  path ? `${IMG}/${size}${path}` : null;

export const year = (d: string | null | undefined) => (d ? d.slice(0, 4) : '');

export const STATUS_LABEL: Record<Status, string> = {
  watching: 'Watching',
  to_watch: 'Plan to watch',
  watched: 'Completed',
  on_hold: 'On hold',
  dropped: 'Dropped',
};
export const STATUS_ORDER: Status[] = ['watching', 'to_watch', 'watched', 'on_hold', 'dropped'];

export function minutesToText(min: number): string {
  if (!min) return '0h';
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}
export const hours = (min: number) => Math.round(min / 60);

export function relTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = (Date.now() - Date.parse(iso)) / 1000;
  if (Number.isNaN(diff)) return '';
  if (diff < 45) return 'just now';
  const units: [number, string][] = [
    [60, 'm'],
    [3600, 'h'],
    [86400, 'd'],
    [604800, 'w'],
    [2592000, 'mo'],
    [31536000, 'y'],
  ];
  let prev = 60;
  for (let i = 0; i < units.length; i++) {
    const [s, l] = units[i];
    const next = units[i + 1]?.[0] ?? Infinity;
    if (diff < next) return `${Math.max(1, Math.floor(diff / s))}${l} ago`;
    prev = s;
  }
  void prev;
  return `${Math.floor(diff / 31536000)}y ago`;
}

export function dateText(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }): string {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, opts);
}

export function daysUntil(dateOnly: string): number {
  const t = new Date(`${dateOnly}T00:00:00`).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / 86400000);
}

export function airsIn(dateOnly: string): string {
  const d = daysUntil(dateOnly);
  if (d <= 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d < 7) return `in ${d} days`;
  return dateText(dateOnly, { month: 'short', day: 'numeric' });
}

export const epCode = (s: number, e: number) => `S${s}E${e}`;
export const n = (v: number) => v.toLocaleString();
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function watchCountBadge(count: number): { text: string; tone: string } | null {
  if (count >= 50) return { text: 'Binge Legend', tone: 'success' };
  if (count >= 30) return { text: 'Binge Master', tone: 'danger' };
  if (count >= 10) return { text: 'Devotee', tone: 'signal' };
  if (count >= 5) return { text: 'Super Fan', tone: 'warning' };
  if (count >= 3) return { text: 'Fan', tone: 'info' };
  if (count >= 2) return { text: 'Rewatcher', tone: 'brand' };
  return null;
}

export const TIERS = ['', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];

export function debounce<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let t: ReturnType<typeof setTimeout> | undefined;
  return ((...a: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  }) as T;
}
