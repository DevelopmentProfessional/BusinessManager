/**
 * ============================================================
 * FILE: PendingOrderBadge.jsx
 *
 * PURPOSE:
 *   Badge component showing pending order count on client menu icon.
 *   Displays when there are orders awaiting client review/revision.
 * ============================================================
 */

import React, { useState, useEffect } from 'react';

const PendingOrderBadge = ({ clientId }) => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPendingCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadPendingCount, 30000);
    return () => clearInterval(interval);
  }, [clientId]);

  const loadPendingCount = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/v1/pending-orders/count${clientId ? `?client_id=${clientId}` : ''}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setCount(data.pending_count || 0);
      }
    } catch (error) {
      console.error('Failed to load pending count:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!count) {
    return null;
  }

  return (
    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full animate-pulse">
      {count}
    </span>
  );
};

export default PendingOrderBadge;
