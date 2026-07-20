import clsx from 'clsx'
import { Link } from '@/components/ui/link'
import { Text } from '@/components/ui/text'
import { surfaceHero, surfaceSunken } from '@/components/ui/surface'

/**
 * Éléments de mise en page du registre — direction « registre institutionnel ».
 *
 * Ne contient aucune logique métier : uniquement la grammaire visuelle partagée
 * par les écrans du dossier (en-tête de page, sections numérotées, statistiques
 * alignées, raccourcis compacts).
 */

/**
 * Titre de page canonique — la seule grammaire d'en-tête du produit.
 *
 * Une LIGNE, pas une carte. La sidebar dit déjà où l'on est : réenfermer le nom
 * de la page dans un bloc de 130 px repousse le premier chiffre sous la ligne
 * de flottaison sans rien apprendre au lecteur. `meta` porte le contexte à
 * droite (périmètre, date d'as-of), `actions` les commandes de la page.
 */
export function PageTitle({
  title,
  meta,
  actions,
  backHref,
  backLabel,
}: {
  title: string
  meta?: React.ReactNode
  actions?: React.ReactNode
  backHref?: string
  backLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        {backHref && (
          // min-h-11 / -mx-2 px-2 : cible tactile de 44px sans décaler le texte.
          // Aucune gate ne vérifie la taille des cibles (check-a11y.mjs couvre
          // onClick-sans-rôle, img sans alt et les labels) : la contrainte doit
          // donc vivre dans le canon, sinon elle se perd silencieusement.
          <Link
            href={backHref}
            className="-mx-2 -my-1 inline-flex min-h-11 items-center px-2 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            ← {backLabel ?? 'Back'}
          </Link>
        )}
        <h1 className="truncate text-xl/7 font-semibold tracking-tight text-[var(--ds-text)]">{title}</h1>
      </div>
      {/* Pas de shrink-0 : un meta long y écrasait le titre ou se renvoyait
          seul sur une ligne. Il se réduit et passe à la ligne proprement. */}
      <div className="flex min-w-0 items-center gap-3">
        {meta && <p className="text-xs text-balance text-[var(--ds-muted)]">{meta}</p>}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  decor,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  /**
   * Couche décorative rendue à l'intérieur de la surface, sous le texte.
   * `surfaceHero` est opaque : un décor placé derrière l'en-tête ne ressortirait
   * que par les bords. Réservé aux écrans de tête — jamais sur une page de
   * chiffres, où rien ne doit se lire par-dessus un motif.
   */
  decor?: React.ReactNode
}) {
  return (
    <div className={clsx(surfaceHero, 'relative isolate mb-2 overflow-hidden')}>
      {decor && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          {decor}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="text-xs font-semibold tracking-[0.12em] text-accent-600 uppercase dark:text-accent-400">
              {eyebrow}
            </p>
          )}
          <h1 className="mt-2 text-2xl/8 font-semibold tracking-tight text-[var(--ds-text)]">{title}</h1>
          {description && (
            <p className="mt-2 text-base/6 text-zinc-600 sm:text-sm/6 dark:text-zinc-300">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/**
 * Section numérotée — le numéro d'ordre est la marque du registre : il donne au
 * lecteur institutionnel une table des matières implicite.
 */
export function Section({
  index,
  title,
  description,
  actions,
  children,
  className,
}: {
  index?: string
  /**
   * Optionnel : une section d'ouverture qui répète le titre de la page ajoute un
   * doublon et pousse le contenu sous la ligne de flottaison. Sans titre, la
   * section rend directement son contenu, sans filet ni en-tête.
   */
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const hasHeader = Boolean(title || actions || description)

  return (
    <section
      className={clsx(className, hasHeader && 'border-t border-zinc-950/10 pt-8 dark:border-white/10')}
    >
      {hasHeader && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-3">
              {index && (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-200/80 text-xs font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {index}
                </span>
              )}
              {title && <h2 className="text-base/6 font-semibold text-[var(--ds-text)]">{title}</h2>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
          {description && <Text className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-300">{description}</Text>}
        </>
      )}
      <div className={clsx(hasHeader && 'mt-5', surfaceSunken, 'p-5 sm:p-6')}>{children}</div>
    </section>
  )
}

/** Statistique alignée — libellé discret, valeur en tabular-nums. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--ds-muted)]">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums text-[var(--ds-text)]">
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>}
    </div>
  )
}

/** En-tête de panneau latéral — libellé uppercase aligné sur la grammaire registre. */
export function PanelHeading({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--ds-border)] px-4 py-3">
      <h2 className="text-xs font-semibold tracking-[0.12em] text-zinc-500 uppercase dark:text-zinc-400">
        {title}
      </h2>
      {action}
    </div>
  )
}

/** Ligne clé/valeur d'un relevé — valeur alignée à droite, tabular-nums. */
export function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-[var(--ds-muted)]">{label}</dt>
      <dd className="text-right text-sm font-medium tabular-nums text-[var(--ds-text)]">{value}</dd>
    </div>
  )
}

/**
 * Barre de complétion — rendue en filets plutôt qu'en barre colorée pleine,
 * pour rester dans le registre sobre.
 */
export function ProgressBar({ value, total, label }: { value: number; total: number; label?: string }) {
  const safeTotal = total > 0 ? total : 1
  const pct = Math.min(100, Math.max(0, Math.round((value / safeTotal) * 100)))
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm tabular-nums text-[var(--ds-text)]">
          <span className="text-xl font-semibold tracking-tight">{value}</span>
          <span className="text-zinc-400 dark:text-zinc-500"> / {total}</span>
        </span>
        {label && <span className="text-xs text-[var(--ds-muted)]">{label}</span>}
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progression'}
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-950/10 dark:bg-white/10"
      >
        <div className="h-full rounded-full bg-accent-600 dark:bg-accent-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/**
 * Raccourci compact — remplace les EmptyState pleine largeur qui donnaient
 * l'impression d'un produit en chantier. Une bande de raccourcis dit la même
 * chose en un tiers de la hauteur.
 */
export function ShortcutRow({
  title,
  status,
  href,
  icon: Icon,
}: {
  title: string
  status: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    // Link et non <a> : une ancre native n'émet JAMAIS data-focus, donc les
    // styles data-focus: ci-dessous n'étaient jamais appliqués et le focus
    // clavier était invisible sur tous les raccourcis. Elle perdait aussi la
    // navigation côté client.
    <Link
      href={href}
      className="group -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-white/70 focus:not-data-focus:outline-hidden data-focus:outline-2 data-focus:outline-offset-2 data-focus:outline-accent-500 dark:hover:bg-white/5"
    >
      <Icon className="size-4 shrink-0 fill-zinc-400 dark:fill-zinc-500" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--ds-text)]">{title}</span>
      <span className="shrink-0 text-xs text-[var(--ds-muted)]">{status}</span>
    </Link>
  )
}
