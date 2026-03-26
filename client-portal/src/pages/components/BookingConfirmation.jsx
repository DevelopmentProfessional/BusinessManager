/**
 * BOOKING CONFIRMATION MODAL
 * Shown after a service booking is successfully created in the database.
 */
import React from 'react'
import { CheckCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/solid'
import { format } from 'date-fns'

export default function BookingConfirmation({ service, slot, onClose, onViewBookings }) {
  const appointmentDate = slot?.start ? new Date(slot.start) : null
  const modeLabel = slot?.booking_mode === 'locked' ? 'Locked Booking' : 'Soft Booking'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center">
        <CheckCircleIcon className="w-16 h-16 text-green-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-1">Booking Confirmed!</h2>
        <p className="text-sm text-gray-500 mb-6">Your appointment has been registered.</p>

        <div className="w-full bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarDaysIcon className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-medium">{service?.name}</span>
          </div>
          {appointmentDate && (
            <div className="text-sm text-gray-600 pl-6">
              {format(appointmentDate, 'EEEE, MMMM d, yyyy')}
              <br />
              {format(appointmentDate, 'h:mm a')}
              {service?.duration_minutes && ` · ${service.duration_minutes} min`}
            </div>
          )}
          <div className="pl-6">
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
              slot?.booking_mode === 'locked'
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {modeLabel}
            </span>
          </div>
        </div>

        <div className="flex gap-3 w-full">
          <button
            onClick={onClose}
            className="flex-1 btn-secondary"
          >
            Continue Shopping
          </button>
          <button
            onClick={onViewBookings}
            className="flex-1 btn-primary"
          >
            View My Bookings
          </button>
        </div>
      </div>
    </div>
  )
}
