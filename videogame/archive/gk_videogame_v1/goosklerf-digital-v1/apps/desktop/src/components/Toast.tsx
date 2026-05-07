import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type ToastKind = 'info' | 'error' | 'success'

interface ToastEntry {
  id: number
  kind: ToastKind
  message: string
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void
  error: (message: string) => void
  success: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const counter = useRef(0)

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    counter.current += 1
    const id = counter.current
    setToasts(prev => [...prev, { id, kind, message }])
    window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, kind === 'error' ? 4500 : 2500)
  }, [])

  const api: ToastApi = {
    show,
    error: msg => show(msg, 'error'),
    success: msg => show(msg, 'success'),
    info: msg => show(msg, 'info'),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      show: () => {},
      error: () => {},
      success: () => {},
      info: () => {},
    }
  }
  return ctx
}
