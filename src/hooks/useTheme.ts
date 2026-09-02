// CS50 Final Project — src/hooks/useTheme.ts: Reusable React state-management hook.
// AI assistance citation: OpenAI Codex helped migrate, document, and review this file for the CS50 final project; product decisions and final responsibility remain with Matheus Lira.
import { useEffect, useState } from 'react'
import { defaultAccent } from '../lib/theme'
import type { ThemeMode } from '../types/finance'

const themeKey = 'finance-theme-mode'
const accentKey = 'finance-accent-color'

function storedTheme(): ThemeMode {
  return localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark'
}

function storedAccent() {
  return localStorage.getItem(accentKey) || defaultAccent
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(storedTheme)
  const [accent, setAccent] = useState(storedAccent)

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    localStorage.setItem(themeKey, mode)
  }, [mode])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
    localStorage.setItem(accentKey, accent)
  }, [accent])

  return {
    mode,
    accent,
    setMode,
    setAccent,
    toggleMode: () => setMode((current) => (current === 'dark' ? 'light' : 'dark')),
  }
}

