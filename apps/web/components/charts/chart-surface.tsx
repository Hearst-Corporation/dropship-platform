import clsx from 'clsx'
import { surfaceRaised } from '@/components/ui/surface'

export function ChartSurface({
  title,
  description,
  actions,
  children,
  className,
}: {
  /**
   * Optionnel : quand la Section porte déjà le titre, le répéter au-dessus du
   * graphe empile deux en-têtes à quelques pixels. Sans titre ni description,
   * la légende disparaît entièrement et le graphe occupe toute la carte.
   */
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const hasCaption = Boolean(title || description || actions)

  // flex h-full flex-col : dans une grille où les cellules s'étirent à égalité,
  // la figure remplit toute la hauteur de sa cellule (sinon deux cartes
  // côte à côte ont des hauteurs différentes). Le corps grandit ; l'appelant
  // décide de l'alignement de son contenu dans cet espace.
  return (
    <figure className={clsx(surfaceRaised, 'flex h-full flex-col p-6', className)}>
      {hasCaption && (
        <figcaption className="mb-5 border-b border-zinc-950/5 pb-4 dark:border-white/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {title && <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</h3>}
              {description && (
                <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
              )}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
          </div>
        </figcaption>
      )}
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
    </figure>
  )
}
