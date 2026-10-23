export const RELOAD_FLAG = 'bartrrr:chunk-reload'

/** A deploy replaced the hashed chunks this tab was about to lazy-load. */
export function isStaleChunkError(error: Error): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i.test(
    error.message,
  )
}

/** Reload once to pick up the new build. Returns false if already tried. */
export function reloadOnceForNewBuild(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false
    sessionStorage.setItem(RELOAD_FLAG, '1')
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/** Clear the one-shot reload guard once a page renders successfully. */
export function clearChunkReloadFlag(): void {
  try {
    sessionStorage.removeItem(RELOAD_FLAG)
  } catch {
    /* ignore */
  }
}
