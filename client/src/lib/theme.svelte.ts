export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'wr-theme';
const mq = matchMedia('(prefers-color-scheme: dark)');

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

class Theme {
  pref = $state<ThemePref>(read());
  osDark = $state(mq.matches);

  constructor() {
    mq.addEventListener('change', (e) => (this.osDark = e.matches));
    $effect.root(() => {
      $effect(() => {
        document.documentElement.classList.toggle('dark', this.dark);
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', this.dark ? '#0e1011' : '#0d9488');
      });
    });
  }

  get dark() {
    return this.pref === 'dark' || (this.pref === 'system' && this.osDark);
  }

  set(pref: ThemePref) {
    this.pref = pref;
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      /* private mode */
    }
  }

  toggle() {
    this.set(this.dark ? 'light' : 'dark');
  }
}

export const theme = new Theme();
