import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "./useStore";

/**
 * Guards a page by redirecting to /profile if the user lacks any
 * read/write/delete/admin permission for the given page name.
 *
 * Waits for authReady before checking so that iOS (which clears
 * sessionStorage on background) and slow-init scenarios don't cause
 * a false redirect before permissions have been restored.
 *
 * @param {string} pageName - The permission namespace (e.g. 'inventory')
 */
export default function usePagePermission(pageName) {
  const navigate = useNavigate();
  const attemptedRefetch = useRef(false);
  // Read authReady and permissions from the store directly so the effect
  // re-runs after permissions are fetched (not just on mount).
  const { hasPageAccess, authReady, permissions, refetchPermissions } = useStore();

  useEffect(() => {
    // Don't redirect until auth is initialised — prevents false negatives
    // on iOS where permissions are refetched asynchronously after mount.
    if (!authReady) return;
    let cancelled = false;

    const checkAccess = async () => {
      if (cancelled) return;
      if (hasPageAccess(pageName)) {
        if (!cancelled) {
          attemptedRefetch.current = false;
        }
        return;
      }

      // Attempt one permission refresh before redirecting. This prevents
      // stale local permission state from causing false denies.
      if (!attemptedRefetch.current) {
        if (cancelled) return;
        attemptedRefetch.current = true;
        try {
          await refetchPermissions();
        } catch (error) {
          console.error("Failed to refetch permissions in usePagePermission:", error);
        }
        if (cancelled) return;
        if (useStore.getState().hasPageAccess(pageName)) {
          return;
        }
      }

      if (cancelled) return;
      navigate("/profile", { replace: true });
    };

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [authReady, permissions]); // eslint-disable-line react-hooks/exhaustive-deps
}
