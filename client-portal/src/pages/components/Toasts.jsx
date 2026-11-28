import React from 'react'
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import useStore from '../../store/useStore'

const ICONS = {
  success: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
  error:   <ExclamationCircleIcon className="w-5 h-5 text-red-500" />,
  info:    <InformationCircleIcon className="w-5 h-5 text-blue-500" />,
}

export default function Toasts() {
  const toasts = useStore(s => s.toasts)
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="toast">
          {ICONS[t.type] || ICONS.info}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
