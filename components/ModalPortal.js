'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Renders into document.body instead of in place, so a position:fixed modal
// never ends up trapped inside an ancestor with transform/filter (which turns
// that ancestor into the fixed element's containing block and breaks centering).
export default function ModalPortal({ children }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}
