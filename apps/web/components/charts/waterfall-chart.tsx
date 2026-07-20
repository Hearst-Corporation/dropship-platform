'use client'

import { Group } from '@visx/group'
import { Bar, Line } from '@visx/shape'
import { scaleLinear, scaleBand } from '@visx/scale'
import { AxisLeft } from '@visx/axis'
import { GridRows } from '@visx/grid'
import { ParentSize } from '@visx/responsive'
import { usdB } from '@/lib/data-center/model/format'

/**
 * Cascade de création de valeur — porté du qatar-cockpit d'origine
 * (composant Recharts `WaterfallChart`), reconstruit en @visx et aligné sur
 * la grammaire actuelle : monochrome accent + zinc, mode sombre, zéro scroll.
 *
 * Deux ancres à 0 (capital déployé = base de coût, valeur totale = résultat) et,
 * entre les deux, des barres FLOTTANTES qui cumulent : chaque apport part du
 * total courant. On lit d'un coup comment le capital devient valeur de plateforme,
 * ce qu'une table de montants ne montre pas.
 */

export type WaterfallStep = {
  label: string
  /** Montant signé de l'apport (négatif = destruction de valeur). */
  amount: number
  /** Barre ancrée à 0 (référence) plutôt que flottante : capital et total. */
  anchor?: boolean
  /** Barre de coût (capital déployé) — rendue en zinc, pas en accent. */
  cost?: boolean
  /** Résultat final — accent plein souligné d'un liseré. */
  total?: boolean
  /** Apport optionnel non contracté (LLM) — accent atténué. */
  optional?: boolean
}

type Placed = WaterfallStep & { base: number; top: number }

/** Répartit un libellé sur deux lignes au plus, sans troncature. */
function wrapLabel(label: string): string[] {
  const words = label.split(' ')
  if (words.length <= 1) return [label]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
}

export function WaterfallChart({ steps }: { steps: WaterfallStep[] }) {
  if (steps.length === 0) return null

  // Calcul des bases flottantes en cumul courant. reduce plutôt qu'un `let`
  // muté dans un map : le React Compiler interdit la réassignation en cours de
  // rendu. Le cumul est porté par l'accumulateur, pas par une variable fermée.
  const placed: Placed[] = steps.reduce<{ running: number; rows: Placed[] }>(
    (acc, s) => {
      if (s.anchor) {
        acc.rows.push({ ...s, base: 0, top: Math.abs(s.amount) })
        return acc
      }
      const next = acc.running + s.amount
      acc.rows.push({ ...s, base: Math.min(acc.running, next), top: Math.max(acc.running, next) })
      acc.running = next
      return acc
    },
    { running: 0, rows: [] },
  ).rows

  const maxTop = Math.max(...placed.map((p) => p.top), 0)
  const minBase = Math.min(...placed.map((p) => p.base), 0)

  return (
    <div className="h-[300px] w-full sm:h-[340px]" role="img" aria-label="Value creation waterfall">
      <ParentSize debounceTime={0} enableDebounceLeadingCall>
        {({ width, height }) => {
          if (width < 10 || height < 10) return null

          const margin = { top: 28, right: 8, bottom: 52, left: 52 }
          const xMax = width - margin.left - margin.right
          const yMax = height - margin.top - margin.bottom

          const xScale = scaleBand<string>({
            range: [0, xMax],
            domain: placed.map((p) => p.label),
            padding: 0.32,
          })

          const yScale = scaleLinear<number>({
            range: [yMax, 0],
            domain: [Math.min(0, minBase) * 1.05, maxTop * 1.08],
            nice: true,
          })

          const bw = xScale.bandwidth()

          const fillFor = (p: Placed) => {
            if (p.cost) return 'var(--color-zinc-500)'
            if (p.amount < 0) return 'var(--color-zinc-400)'
            return p.total ? 'var(--color-accent-600)' : 'var(--color-accent-500)'
          }

          return (
            <svg width={width} height={height} className="overflow-visible">
              <Group left={margin.left} top={margin.top}>
                <GridRows scale={yScale} width={xMax} strokeOpacity={0.1} stroke="var(--color-zinc-600)" />

                <AxisLeft
                  scale={yScale}
                  numTicks={5}
                  tickFormat={(v) => usdB(v.valueOf())}
                  hideAxisLine
                  hideTicks
                  tickLabelProps={{ fill: 'var(--color-zinc-500)', fontSize: 10, textAnchor: 'end', dy: '0.33em' }}
                />

                {/* ligne de zéro */}
                <Line
                  from={{ x: 0, y: yScale(0) ?? 0 }}
                  to={{ x: xMax, y: yScale(0) ?? 0 }}
                  stroke="var(--color-zinc-600)"
                  strokeOpacity={0.4}
                />

                {placed.map((p, i) => {
                  const x = xScale(p.label) ?? 0
                  const yTop = yScale(p.top) ?? 0
                  const yBase = yScale(p.base) ?? 0
                  const barH = Math.max(Math.abs(yBase - yTop), 1)
                  // connecteur pointillé vers l'apport suivant (sauf après le total)
                  const next = placed[i + 1]
                  const connectorY = yScale(p.anchor && p.total ? p.top : p.top) ?? 0
                  return (
                    <Group key={p.label}>
                      {next && !p.total && (
                        <Line
                          from={{ x: x + bw, y: connectorY }}
                          to={{ x: (xScale(next.label) ?? 0), y: connectorY }}
                          stroke="var(--color-zinc-500)"
                          strokeOpacity={0.35}
                          strokeDasharray="2,2"
                        />
                      )}
                      <Bar
                        x={x}
                        y={yTop}
                        width={bw}
                        height={barH}
                        rx={3}
                        fill={fillFor(p)}
                        fillOpacity={p.optional ? 0.55 : 1}
                        stroke={p.total ? 'var(--color-accent-400)' : undefined}
                        strokeWidth={p.total ? 1.5 : 0}
                      />
                      {/* montant au sommet de la barre */}
                      <text
                        x={x + bw / 2}
                        y={yTop - 6}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={p.total ? 600 : 500}
                        fill={p.total ? 'var(--color-accent-400)' : 'var(--color-zinc-300)'}
                      >
                        {p.cost || p.amount < 0 ? `−${usdB(Math.abs(p.amount))}` : usdB(Math.abs(p.amount))}
                      </text>
                      {/* libellé d'axe X, réparti sur deux lignes (pas de troncature) */}
                      {wrapLabel(p.label).map((line, li) => (
                        <text
                          key={li}
                          x={x + bw / 2}
                          y={yMax + 16 + li * 12}
                          textAnchor="middle"
                          fontSize={10}
                          fill="var(--color-zinc-500)"
                        >
                          {line}
                        </text>
                      ))}
                    </Group>
                  )
                })}
              </Group>
            </svg>
          )
        }}
      </ParentSize>
    </div>
  )
}
