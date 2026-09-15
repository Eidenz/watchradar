// Preferred-title resolution shared by the API (SSR/oEmbed) and the client.
const LANG_TO_COUNTRY = { ja: 'JP', en: 'US', ko: 'KR', fr: 'FR', de: 'DE', es: 'ES', zh: 'CN' };

export function preferredTitle(media, lang = 'en') {
  if (!media) return '';
  if (lang === 'original') return media.original_title || media.title;
  if (lang === 'en') return media.title;
  let alts = media.alternative_titles;
  if (typeof alts === 'string') {
    try {
      alts = JSON.parse(alts);
    } catch {
      alts = [];
    }
  }
  const country = LANG_TO_COUNTRY[lang];
  if (Array.isArray(alts) && country) {
    const hit = alts.find((t) => t.iso_3166_1 === country && t.title);
    if (hit) return hit.title;
  }
  if (media.original_language === lang) return media.original_title || media.title;
  return media.title;
}
