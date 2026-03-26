/**
 * BOOKING CALENDAR
 * Interactive availability calendar for booking services.
 * Queries /api/client/catalog/services/{id}/availability for real-time slots.
 *
 * Props:
 *   service     — CatalogServiceRead object
 *   companyId   — string
 *   onSelect    — (slot) => void   called when user picks a slot
 *   onClose     — () => void
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns'
import { enUS } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { catalogAPI } from '../../services/api'
import { XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'

const locales = { 'en-US': enUS }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
})

// Booking mode labels and tooltips
const MODE_INFO = {
  soft:   { label: 'Soft Booking',   color: 'bg-amber-100 text-amber-800',   desc: 'No payment now. A cancellation fee applies if cancelled.' },
  locked: { label: 'Locked Booking', color: 'bg-green-100 text-green-800',   desc: 'Pay now to guarantee your slot. Partial refund if cancelled.' },
}

export default function BookingCalendar({ service, companyId, onSelect, onClose, submitting = false }) {
  const [slots,       setSlots]       = useState([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [selected,    setSelected]    = useState(null)
  const [bookingMode, setBookingMode] = useState('soft')
  const [viewDate,    setViewDate]    = useState(new Date())

  const loadSlots = useCallback(async (from, to) => {
    if (!service?.id || !companyId) return
    setLoading(true)
    setError(null)
    try {
      const data = await catalogAPI.getAvailability(service.id, companyId, {
        date_from: from.toISOString(),
        date_to:   to.toISOString(),
      })
      setSlots(data)
    } catch (err) {
      setError('Could not load availability. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [service?.id, companyId])

  useEffect(() => {
    const from = new Date()
    const to   = addDays(from, 30)
    loadSlots(from, to)
  }, [loadSlots])

  // Convert slots to react-big-calendar events
  const events = slots
    .filter(s => s.available)
    .map((s, i) => ({
      id:    i,
      title: `Available — ${format(new Date(s.start), 'h:mm a')}`,
      start: new Date(s.start),
      end:   new Date(s.end),
      slot:  s,
    }))

  function handleSelectEvent(event) {
    setSelected(event.slot)
  }

  function handleConfirm() {
    if (!selected) return
    onSelect?.({ ...selected, booking_mode: bookingMode })
  }

  const modeInfo = MODE_INFO[bookingMode]

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <CalendarDaysIcon className="w-6 h-6 text-primary" />
            <div>
              <h2 className="font-semibold text-gray-900">{service.name}</h2>
              <p className="text-sm text-gray-500">{service.duration_minutes} min · ${service.price?.toFixed(2)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Booking mode selector */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex gap-3">
          {Object.entries(MODE_INFO).map(([mode, info]) => (
            <button
              key={mode}
              onClick={() => setBookingMode(mode)}
              className={[
                'flex-1 py-2 px-4 rounded-lg text-sm font-medium border-2 transition-all',
                bookingMode === mode
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              ].join(' ')}
            >
              {info.label}
            </button>
          ))}
        </div>
        <p className="px-6 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-100">
          {modeInfo.desc}
        </p>

        {/* Calendar */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex items-center justify-center h-64 text-red-500 text-sm">{error}</div>
          )}
          {!loading && !error && (
            <Calendar
              localizer={localizer}
              events={events}
              defaultView="week"
              views={['week', 'day']}
              step={30}
              timeslots={2}
              date={viewDate}
              onNavigate={setViewDate}
              onSelectEvent={handleSelectEvent}
              selected={selected ? events.find(e => e.slot === selected) : undefined}
              style={{ height: 460 }}
              eventPropGetter={(event) => ({
                style: {
                  backgroundColor: event.slot === selected ? '#4338CA' : '#4F46E5',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                },
              })}
              toolbar
            />
          )}
        </div>

        {/* Selected slot + confirm */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            {selected ? (
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {format(new Date(selected.start), 'EEEE, MMMM d · h:mm a')}
                </p>
                <span className={`badge ${modeInfo.color} mt-1`}>{modeInfo.label}</span>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Click a green slot to select a time.</p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={handleConfirm}
              disabled={!selected || submitting}
              className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {submitting
                ? 'Booking…'
                : bookingMode === 'locked' ? 'Proceed to Payment' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
