import { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle, Keyboard } from 'lucide-react'
import { clsx } from 'clsx'
import { useToastStore, type ToastItem, type ToastType } from '../stores/toastStore'

// Re-export for convenience
export { toast, useToastStore, type ToastItem, type ToastType } from '../stores/toastStore'

// Individual toast component
function ToastItemComponent({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [isExiting, setIsExiting] = useState(false)
  const duration = item.duration ?? 5000

  useEffect(() => {
    if (duration <= 0) return

    const timer = setTimeout(() => {
      setIsExiting(true)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  useEffect(() => {
    if (isExiting) {
      const timer = setTimeout(onClose, 200)
      return () => clearTimeout(timer)
    }
  }, [isExiting, onClose])

  const handleClose = () => {
    setIsExiting(true)
  }

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
    shortcut: <Keyboard className="w-5 h-5 text-zinc-500" />,
  }

  const bgColors: Record<ToastType, string> = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
    shortcut: 'bg-zinc-50 border-zinc-200',
  }

  // Shortcut toasts are more compact
  if (item.type === 'shortcut') {
    return (
      <div
        className={clsx(
          'flex items-center gap-3 px-4 py-2.5 rounded-lg border shadow-lg backdrop-blur-sm',
          'transition-all duration-200 ease-out',
          bgColors[item.type],
          isExiting 
            ? 'opacity-0 translate-x-4' 
            : 'opacity-100 translate-x-0 animate-slide-in-right'
        )}
        role="status"
      >
        {icons[item.type]}
        <span className="text-sm font-medium text-zinc-900">{item.title}</span>
        {item.shortcutKey && (
          <kbd className="kbd text-[10px]">{item.shortcutKey}</kbd>
        )}
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm min-w-[320px] max-w-[420px]',
        'transition-all duration-200 ease-out',
        bgColors[item.type],
        isExiting 
          ? 'opacity-0 translate-x-4' 
          : 'opacity-100 translate-x-0 animate-slide-in-right'
      )}
      role="alert"
    >
      <div className="flex-shrink-0 mt-0.5">
        {icons[item.type]}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-900">{item.title}</p>
        {item.message && (
          <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">{item.message}</p>
        )}
      </div>
      
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 hover:bg-zinc-200/50 rounded transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-zinc-500" />
      </button>
    </div>
  )
}

// Toast container component
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((item) => (
        <ToastItemComponent
          key={item.id}
          item={item}
          onClose={() => removeToast(item.id)}
        />
      ))}
    </div>
  )
}
