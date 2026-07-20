import clsx from 'clsx'

/**
 * Grammaire de surface du dossier — registre institutionnel avec profondeur marquée.
 *
 * Trois plans :
 * - `surfaceRaised`  — cartes, tableaux, métriques (relief fort + ombre marquée)
 * - `surfaceSunken`  — zones secondaires, champs, listes denses
 * - `surfaceHero`    — en-têtes de page
 */

export const surfaceRaised =
  'rounded-xl bg-white shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:shadow-none dark:ring-white/10'

export const surfaceSunken =
  'rounded-xl bg-zinc-50/80 ring-1 ring-zinc-950/5 dark:bg-zinc-950/50 dark:ring-white/5'

export const surfaceHero =
  'rounded-xl bg-gradient-to-b from-zinc-50 to-white px-6 py-5 shadow-md ring-1 ring-zinc-950/10 dark:from-zinc-900 dark:to-zinc-900/60 dark:ring-white/10'

export function Band({
  className,
  divided = true,
  ...props
}: { divided?: boolean } & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        divided && 'border-t border-zinc-950/10 pt-8 dark:border-white/10',
        surfaceSunken,
        'p-5 sm:p-6',
      )}
    />
  )
}

export function Panel({
  className,
  inset = 'md',
  tone = 'raised',
  ...props
}: {
  inset?: 'none' | 'sm' | 'md' | 'lg'
  tone?: 'raised' | 'sunken'
} & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        tone === 'raised' ? surfaceRaised : surfaceSunken,
        inset === 'sm' && 'p-4',
        inset === 'md' && 'p-6',
        inset === 'lg' && 'p-8',
      )}
    />
  )
}

export function RowList({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        surfaceRaised,
        'divide-y divide-zinc-950/5 px-3 dark:divide-white/5 sm:px-4',
      )}
    />
  )
}
