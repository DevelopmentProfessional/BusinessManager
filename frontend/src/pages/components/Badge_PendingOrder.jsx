/**
 * ============================================================
 * FILE: Badge_PendingOrder.jsx
 *
 * PURPOSE:
 *   Badge component showing pending order count on client menu icon.
 *   Displays when there are orders awaiting client review/revision.
 * ============================================================
 */

import React, { useState, useEffect, useCallback } from "react";
import api from "../../services/api";

const Badge_PendingOrder = ({ clientId }) => {
  const [count, setCount] = useState(0);

  const loadPendingCount = useCallback(async () => {
    try {
      const response = await api.get(`/pending-orders/count${clientId ? `?client_id=${clientId}` : ""}`);
      const data = response?.data ?? {};
      setCount(data.pending_count || 0);
    } catch (error) {
      console.error("Failed to load pending count:", error);
    }
  }, [clientId]);

  useEffect(() => {
    loadPendingCount();

    // Refresh every 30 seconds
    const interval = setInterval(loadPendingCount, 30000);
    return () => clearInterval(interval);
  }, [loadPendingCount]);

  if (!count) {
    return null;
  }

  return <span className="-translate-y-1/2 absolute animate-pulse bg-red-600 font-bold inline-flex items-center justify-center leading-none px-0 py-1 right-0 rounded-full text-white text-xs top-0 transform translate-x-1/2">{count}</span>;
};

export default Badge_PendingOrder;
