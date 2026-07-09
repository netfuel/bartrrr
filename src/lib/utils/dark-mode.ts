const KEY = 'bartrrr-dark-mode'

function getPreference(): boolean {
  const stored = localStorage.getItem(KEY)
  if (stored !== null) return stored === 'true'
  return false // default to light mode until the user explicitly changes it
}

function applyDark(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem(KEY, String(dark))
}

export function initDarkMode() {
  applyDark(getPreference())
}

export function toggleDarkMode(): boolean {
  const next = !document.documentElement.classList.contains('dark')
  applyDark(next)
  return next
}

export function isDarkMode(): boolean {
  return document.documentElement.classList.contains('dark')
}
