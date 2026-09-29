import { useState, useEffect } from 'react';

export type Route =
  | { name: 'admin' }
  | { name: 'gallery'; code: string }
  | { name: 'confirmation'; orderId: string };

export function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '');
  const path = hash || '/';
  const parts = path.split('/').filter(Boolean);

  if (parts.length >= 2 && parts[0] === 'g') {
    return { name: 'gallery', code: parts[1] };
  }
  if (parts.length >= 2 && parts[0] === 'c') {
    return { name: 'confirmation', orderId: parts[1] };
  }
  return { name: 'admin' };
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseRoute());

  useEffect(() => {
    const handler = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  return route;
}
