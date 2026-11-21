'use client'

import { useEffect, useState } from 'react'

const KEY = 'urdaneta-theme'

export function useTheme() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    const onChange = () => setDark(document.documentElement.getAttribute('data-theme') === 'dark')
    window.addEventListener('urdaneta-theme-change', onChange)
    return () => window.removeEventListener('urdaneta-theme-change', onChange)
  }, [])

  function toggle() {
    const next = !dark
    if (next) document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    try { localStorage.setItem(KEY, next ? 'dark' : 'light') } catch {}
    window.dispatchEvent(new Event('urdaneta-theme-change'))
  }

  return { dark, toggle }
}
