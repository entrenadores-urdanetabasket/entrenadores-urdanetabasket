// Avisos breves (toasts). Uso: toast('Guardado') o toast('Error al guardar', 'error')
export function toast(message, type = 'success') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('urdaneta-toast', { detail: { message, type } }))
}

export const toastError = message => toast(message, 'error')

// Comprueba el resultado de una escritura a Supabase: si falló avisa con un toast rojo y devuelve false.
// Uso: if (!dbOk(await supabase.from('x').insert(...), 'No se pudo guardar')) return
export function dbOk(res, message = 'No se pudo guardar') {
  if (res?.error) {
    console.error(message, res.error)
    toastError(`${message}: ${res.error.message}`)
    return false
  }
  return true
}
