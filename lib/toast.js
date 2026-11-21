// Avisos breves (toasts). Uso: toast('Guardado') o toast('Error al guardar', 'error')
export function toast(message, type = 'success') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('urdaneta-toast', { detail: { message, type } }))
}

export const toastError = message => toast(message, 'error')
