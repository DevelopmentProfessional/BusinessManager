import { useEffect, useRef } from 'react';

export default function useFetchOnce(fetchFn) {
  const hasFetched = useRef(false);
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchFn();
  }, []);
}
