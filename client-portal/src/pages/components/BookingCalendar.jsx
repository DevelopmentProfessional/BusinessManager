/**
 * BOOKING CALENDAR
 * Bottom-sheet calendar for booking services.
 *
 * Layout:
 *   - Fills the full viewport (above bottom nav, which is ~60 px)
 *   - Header: service name + close button
 *   - Calendar: flex-1, takes all remaining space, no built-in toolbar
 *   - Footer: mode selector (Soft / Hard) + nav circles (M W D T ‹ ›) + Cancel / Confirm
 *
 * Booking modes:
 *   soft  — no payment now; another client can hard-book over it once payment is confirmed
 *   hard  — payment required upfront; overrides any soft booking on the same slot
 */
import React, { useState, useEffect, useCallback } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, addDays, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { catalogAPI } from "../../services/api";
import { XMarkIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

// Bottom nav height — must match Layout.jsx nav
const NAV_H = 60;

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const IcoMonth = () => (
  <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
    <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M2 2a1 1 0 0 0-1 1v1h14V3a1 1 0 0 0-1-1zm13 3H1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1z" />
    <path d="M2.5 7a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H7a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5M2.5 9a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H7a.5.5 0 0 1-.5-.5m4 0a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5" />
  </svg>
);
const IcoWeek = () => (
  <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
    <path d="M11 6.5a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm-3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm-5 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5zm3 0a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5z" />
    <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" />
  </svg>
);
const IcoDay = () => (
  <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
    <path d="M4 .5a.5.5 0 0 0-1 0V1H2a2 2 0 0 0-2 2v1h16V3a2 2 0 0 0-2-2h-1V.5a.5.5 0 0 0-1 0V1H4zM16 14V5H0v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M8.5 8.5V10H10a.5.5 0 0 1 0 1H8.5v1.5a.5.5 0 0 1-1 0V11H6a.5.5 0 0 1 0-1h1.5V8.5a.5.5 0 0 1 1 0" />
  </svg>
);
const IcoToday = () => (
  <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
    <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h1V.5a.5.5 0 0 1 .5-.5M1 4v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z" />
    <text x="8" y="12.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="currentColor">
      T
    </text>
  </svg>
);
const IcoPrev = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
);
const IcoNext = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// ── Circle nav button ─────────────────────────────────────────────────────────
function CircleBtn({ active, onClick, title, children }) {
  const PRIMARY = "var(--cp-primary, #6366f1)";
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: active ? "none" : "1.5px solid #d1d5db",
        background: active ? PRIMARY : "#fff",
        color: active ? "#fff" : "#374151",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        cursor: "pointer",
        flexShrink: 0,
        fontSize: "0.55rem",
        fontWeight: 700,
        lineHeight: 1,
        padding: 0,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Suppress the default RBC toolbar completely ───────────────────────────────
function NoToolbar() {
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BookingCalendar({ service, companyId, onSelect, onClose, submitting = false }) {
  const now = new Date();

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("soft"); // 'soft' | 'locked' (hard)
  const [viewDate, setViewDate] = useState(new Date());
  const [calView, setCalView] = useState("week");

  // ── Load availability ──────────────────────────────────────────────────────
  const loadSlots = useCallback(
    async (from, to) => {
      if (!service?.id || !companyId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await catalogAPI.getAvailability(service.id, companyId, {
          date_from: from.toISOString(),
          date_to: to.toISOString(),
        });
        setSlots(data);
      } catch {
        setError("Could not load availability.");
      } finally {
        setLoading(false);
      }
    },
    [service?.id, companyId]
  );

  useEffect(() => {
    loadSlots(now, addDays(now, 30));
  }, [loadSlots]);

  // ── Events: include future unavailable slots so blocked times stay visible ─
  const events = slots
    .filter((s) => new Date(s.start) >= now)
    .map((s, i) => ({
      id: i,
      title: s.available ? format(new Date(s.start), "h:mm a") : "Unavailable",
      start: new Date(s.start),
      end: new Date(s.end),
      slot: s,
    }));

  function handleSelectEvent(ev) {
    if (!ev.slot.available || new Date(ev.slot.start) < now) return;
    setSelected(ev.slot);
  }

  function handleConfirm() {
    if (!selected) return;
    // 'soft' → booking_mode: 'soft'
    // 'locked' (hard) → booking_mode: 'locked'
    onSelect?.({ ...selected, booking_mode: mode });
  }

  // ── Nav helpers ────────────────────────────────────────────────────────────
  function navPrev() {
    if (calView === "month")
      setViewDate((d) => {
        const n = new Date(d);
        n.setMonth(n.getMonth() - 1);
        return n;
      });
    else if (calView === "week") setViewDate((d) => addDays(d, -7));
    else setViewDate((d) => addDays(d, -1));
  }
  function navNext() {
    if (calView === "month")
      setViewDate((d) => {
        const n = new Date(d);
        n.setMonth(n.getMonth() + 1);
        return n;
      });
    else if (calView === "week") setViewDate((d) => addDays(d, 7));
    else setViewDate((d) => addDays(d, 1));
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const PRIMARY = "var(--cp-primary, #6366f1)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        bottom: NAV_H,
        zIndex: 999,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: "1px solid #f3f4f6",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <CalendarDaysIcon style={{ width: 19, height: 19, color: PRIMARY }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#111827" }}>{service?.name || "—"}</div>
            <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>
              {service?.duration_minutes != null ? `${service.duration_minutes} min` : "—"} · {typeof service?.price === "number" ? `$${service.price.toFixed(2)}` : "N/A"}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 4, display: "flex" }}>
          <XMarkIcon style={{ width: 21, height: 21 }} />
        </button>
      </div>

      {/* ── Calendar (fills all remaining height) ─────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div
              style={{
                width: 28,
                height: 28,
                border: `3px solid ${PRIMARY}`,
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "rbc-spin 0.7s linear infinite",
              }}
            />
          </div>
        )}
        {error && !loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
            <div style={{ color: "#dc2626", fontSize: "0.82rem" }}>{error}</div>
            <button onClick={() => loadSlots(now, addDays(now, 30))} style={{ padding: "6px 16px", background: PRIMARY, color: "#fff", border: "none", borderRadius: "0.4rem", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" }}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <Calendar
            localizer={localizer}
            events={events}
            view={calView}
            views={["month", "week", "day"]}
            onView={setCalView}
            step={30}
            timeslots={2}
            date={viewDate}
            onNavigate={setViewDate}
            onSelectEvent={handleSelectEvent}
            selectable
            style={{ height: "100%" }}
            components={{ toolbar: NoToolbar }}
            eventPropGetter={(ev) => ({
              style: {
                background: !ev.slot.available ? "#d1d5db" : ev.slot === selected ? "#4338ca" : PRIMARY,
                borderRadius: 5,
                border: ev.slot.available && ev.slot === selected ? "2px solid #fff" : "none",
                fontSize: "0.68rem",
                fontWeight: 600,
                color: ev.slot.available ? "#fff" : "#4b5563",
                opacity: ev.slot.available ? 1 : 0.85,
                cursor: ev.slot.available ? "pointer" : "not-allowed",
              },
            })}
            dayPropGetter={(date) => (startOfDay(date) < startOfDay(now) ? { style: { background: "#f9fafb", pointerEvents: "none", opacity: 0.5 } } : {})}
          />
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          borderTop: "1px solid #f3f4f6",
          background: "#fafafa",
          flexShrink: 0,
          padding: "8px 12px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* Row 1: Mode circles + nav circles */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, overflowX: "auto" }}>
          {/* Soft / Hard mode toggles — pill shape */}
          {[
            { key: "soft", label: "Soft", title: "No payment now; can be overridden by a Hard booking" },
            { key: "locked", label: "Hard", title: "Pay upfront to guarantee the slot" },
          ].map(({ key, label, title }) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              title={title}
              style={{
                padding: "0 14px",
                height: 40,
                borderRadius: 20,
                border: mode === key ? "none" : "1.5px solid #d1d5db",
                background: mode === key ? PRIMARY : "#fff",
                color: mode === key ? "#fff" : "#374151",
                fontWeight: 700,
                fontSize: "0.72rem",
                cursor: "pointer",
                flexShrink: 0,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {label}
            </button>
          ))}

          {/* Divider */}
          <div style={{ width: 1, height: 28, background: "#e5e7eb", flexShrink: 0, margin: "0 2px" }} />

          {/* M / W / D / T / < / > nav circles */}
          <CircleBtn active={calView === "month"} onClick={() => setCalView("month")} title="Month view">
            <IcoMonth />
            <span>M</span>
          </CircleBtn>
          <CircleBtn active={calView === "week"} onClick={() => setCalView("week")} title="Week view">
            <IcoWeek />
            <span>W</span>
          </CircleBtn>
          <CircleBtn active={calView === "day"} onClick={() => setCalView("day")} title="Day view">
            <IcoDay />
            <span>D</span>
          </CircleBtn>
          <CircleBtn active={false} onClick={() => setViewDate(new Date())} title="Go to today">
            <IcoToday />
            <span>T</span>
          </CircleBtn>
          <CircleBtn active={false} onClick={navPrev} title="Previous">
            <IcoPrev />
          </CircleBtn>
          <CircleBtn active={false} onClick={navNext} title="Next">
            <IcoNext />
          </CircleBtn>
        </div>

        {/* Row 2: Selected slot info + Cancel / Confirm */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {selected ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "#111827" }}>{format(new Date(selected.start), "EEE MMM d · h:mm a")}</div>
                <div
                  style={{
                    display: "inline-block",
                    marginTop: 2,
                    padding: "1px 8px",
                    borderRadius: 999,
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    background: mode === "locked" ? "#dcfce7" : "#fef3c7",
                    color: mode === "locked" ? "#166534" : "#92400e",
                  }}
                >
                  {mode === "locked" ? "Hard — payment required" : "Soft — no payment now"}
                </div>
              </div>
            ) : (
              <span style={{ fontSize: "0.73rem", color: "#9ca3af" }}>Tap an available slot to select. Greyed out times are already unavailable.</span>
            )}
          </div>

          <div style={{ display: "flex", gap: 7, flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                border: "1.5px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                fontWeight: 600,
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selected || submitting}
              style={{
                padding: "8px 18px",
                borderRadius: 20,
                border: "none",
                background: !selected || submitting ? "#a5b4fc" : PRIMARY,
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.75rem",
                cursor: !selected || submitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "background 0.15s",
              }}
            >
              {submitting && <span style={{ width: 11, height: 11, border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "rbc-spin 0.7s linear infinite" }} />}
              {submitting ? "Booking…" : mode === "locked" ? "Pay & Book" : "Confirm"}
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes rbc-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
