// Applies the saved theme before first paint to avoid a flash (kept external for CSP).
try {
  var t = localStorage.getItem('wr-theme');
  var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
