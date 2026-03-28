import { useEffect } from "react";
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
  // Read authReady and permissions from the store directly so the effect
  // re-runs after permissions are fetched (not just on mount).
  const { hasPageAccess, authReady, permissions } = useStore();

  useEffect(() => {
    // Don't redirect until auth is initialised — prevents false negatives
    // on iOS where permissions are refetched asynchronously after mount.
    if (!authReady) return;

    if (!hasPageAccess(pageName)) {
      navigate("/profile", { replace: true });
    }
  }, [authReady, permissions]); // eslint-disable-line react-hooks/exhaustive-deps
}
