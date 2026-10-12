import { useEffect, useState } from 'react';

export function useRoute(): string[] {
  const parse = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean).map(decodeURIComponent);
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = path.startsWith('/') ? path : `/${path}`;
}

export function back(fallback = '/') {
  if (history.length > 1) history.back();
  else go(fallback);
}
