import { useEffect, useRef } from "react";

export default function useFetchOnce(fetchFn) {
  const hasFetched = useRef(false);
  const fetchRef = useRef(fetchFn);

  useEffect(() => {
    fetchRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchRef.current();
  }, []);
}
