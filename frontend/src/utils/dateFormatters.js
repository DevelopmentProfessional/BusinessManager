// Format: "Jan 15, 2026"
export function formatDate(dt) {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return ''; }
}

// Format: "Jan 15, 2026 2:30 PM"
export function formatDateTime(dt) {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return ''; }
}

// Format: "2026-01-15" (ISO date only)
export function formatDateISO(dt) {
  if (!dt) return '';
  try {
    return new Date(dt).toISOString().split('T')[0];
  } catch { return ''; }
}

// Format: "2:30 PM"
export function formatTime(dt) {
  if (!dt) return '';
  try {
    return new Date(dt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// Format: "2 hours 30 minutes" or "30 minutes"
export function formatDuration(minutes) {
  if (minutes == null || minutes === '') return '--';
  const m = Number(minutes);
  if (isNaN(m)) return '--';
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''}`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
  return `${h} hour${h !== 1 ? 's' : ''} ${rem} minute${rem !== 1 ? 's' : ''}`;
}
