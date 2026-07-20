export const ACCENTS = [
  'indigo',
  'fuchsia',
  'bordeaux',
  'amber',
  'emerald',
  'teal',
  'blue',
  'violet',
] as const

export type Accent = (typeof ACCENTS)[number]

const STORAGE_KEY = 'accent'

const listeners = new Set<() => void>()

export function getStoredAccent(): Accent {
  if (typeof window === 'undefined') return 'indigo'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return (ACCENTS as readonly string[]).includes(stored ?? '') ? (stored as Accent) : 'indigo'
}

export function setAccent(accent: Accent) {
  document.documentElement.setAttribute('data-accent', accent)
  window.localStorage.setItem(STORAGE_KEY, accent)
  listeners.forEach((listener) => listener())
}

/**
 * Abonnement pour useSyncExternalStore : notifié à chaque setAccent, y compris
 * dans l'onglet courant (l'événement `storage` natif ne se déclenche que dans
 * les AUTRES onglets, d'où ce petit registre local).
 */
export function subscribeAccent(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
