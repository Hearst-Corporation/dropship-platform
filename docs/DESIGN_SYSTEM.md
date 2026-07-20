# Design system — Hearst Qatar Deal Room

Document **verrouillé**. Toute UI dans `app/(app)/` et `components/` (hors exclusions) doit respecter ces règles. La CI (`npm run check`) fait foi.

## Principes

1. **Registre institutionnel** — le dossier se lit comme un document officiel, pas un dashboard SaaS coloré.
2. **Une seule couleur de marque** — token `accent` (bordeaux Pantone 1955 C).
3. **Un neutre** — `zinc` pour texte, bordures, fonds.
4. **Primitives obligatoires** — pas d'éléments HTML natifs interactifs hors `components/ui/`.
5. **Sémantique explicite** — statuts et feedback via palette limitée (`amber`, `green`, `red`).

## Langue UI

- **English (US)** pour tout le texte visible (`lib/locale.ts`, `UI_LOCALE = 'en-US'`).
- Dates et nombres : `formatUiDate`, `formatUiDateTime`, formatters modèles (`usdFull`, `formatUsd`, etc.).

## Tokens (`app/globals.css`)

### Accent — Pantone 1955 C

Défini comme `--color-accent-50` … `--color-accent-950`.  
**Ne jamais** utiliser `indigo-*`, `blue-*`, etc. dans l'app — utiliser `accent-*`.

| Usage | Classes typiques |
|-------|------------------|
| CTA principal | `Button color="accent"` |
| Eyebrow / liens actifs | `text-accent-600 dark:text-accent-400` |
| Fond léger | `bg-accent-500/10 ring-accent-500/30` |
| Avatar marque | `bg-accent-600 text-white` |

### Neutres

| Usage | Classes |
|-------|---------|
| Texte principal | `text-zinc-950 dark:text-white` |
| Texte secondaire | `text-zinc-500 dark:text-zinc-400` |
| Bordures | `border-zinc-950/10 dark:border-white/10` |
| Surface | `bg-white dark:bg-zinc-900` |
| Ring carte | `ring-1 ring-zinc-950/5 dark:ring-white/10` |

### Typographie

- **Sans** : Geist Sans (`--font-geist-sans`) — corps, UI
- **Mono** : Geist Mono — IDs, endpoints, cibles audit
- **Chiffres** : `tabular-nums` (global sur `body`)
- **Titres registre** : `text-2xl/8 font-semibold tracking-tight` (PageHeader), sections `text-sm/6 font-semibold`

## Palette sémantique (statuts)

Réservée aux **badges, alertes, bannières** — pas de décoration.

| Sémantique | Couleur Badge | Exemple |
|------------|---------------|---------|
| Manquant / neutre | `zinc` | Document KYC absent |
| En cours / déposé | `amber` | Document uploadé |
| Mis à jour / actif | `accent` | Document remplacé |
| Vérifié / succès | `green` | KYC vérifié |
| Erreur | `red` | Alertes formulaire |

Source KYC : `components/dossier/document-status-badge.tsx`.

## Grammaire de layout

### Corps de page — full width

Dans `app/(app)/`, le contenu principal est **pleine largeur** dans le panneau blanc (espace disponible à droite de la sidebar).

| Couche | Règle | Fichier |
|--------|--------|---------|
| **Shell** | `w-full` — jamais de `max-w-*` sur le wrapper `{children}` | `components/ui/sidebar-layout.tsx` |
| **Page** | Racine de chaque route : `className="w-full"` | `app/(app)/dossier/**` |
| **Prose** | `max-w-2xl` / `max-w-3xl` **uniquement** sur titres, descriptions, paragraphes longs | `PageHeader`, `Text` |
| **Données** | Tableaux, graphiques, kanban : `w-full` dans `Panel` / `Band` | `components/charts/`, simulateurs |
| **Exception** | Export imprimable (`/dossier/export`) : `max-w-3xl` conservé pour la lisibilité papier | `export-view.tsx` |
| **Hors scope** | Landing `app/(site)/` et `components/marketing/` gardent leurs propres `max-w-*` | — |

Ne pas empiler `mx-auto max-w-*` sur la racine de page **et** sur le shell — une seule contrainte de largeur, et c’est le shell qui ne limite pas.

### Registre (`components/dossier/registry.tsx`)

- `PageHeader` — eyebrow accent + titre + description
- `Section` — index `01`, `02`… + filet supérieur
- `DataRow`, `ProgressBar`, `ShortcutRow` — lignes sobres

### Surfaces (`components/ui/surface.tsx`)

Trois tokens exportés : `surfaceRaised` (cartes), `surfaceSunken` (zones secondaires), `surfaceHero` (en-têtes).

| Composant | Usage |
|-----------|--------|
| `Band` | Section pleine largeur, fond enfoncé + filet |
| `Panel` | Conteneur borné — `tone="raised"` (défaut) ou `sunken` |
| `RowList` | Liste à filets dans une carte relevée |

Le shell (`sidebar-layout`) utilise un canvas `zinc-200/80` et un panneau principal blanc en `shadow-md` pour séparer fond / contenu.

### Cartes documents KYC

`DocumentCard` utilise `rounded-xl shadow-sm` — **exception** pour les pièces jointes identifiables. Ne pas généraliser aux pages registre.

## Primitives UI (`components/ui/`)

29 composants **Catalyst** (Tailwind UI). Règles :

- **Ne pas modifier le style** des primitives pour des besoins ponctuels — composer depuis l'extérieur.
- ESLint **ignore** `components/ui/**`.
- Toujours préférer : `Button`, `Input`, `Textarea`, `Table`, `Dialog`, `Badge`, `Sidebar`, etc.

### Boutons

| Variant | Usage |
|---------|--------|
| `color="accent"` | Action primaire |
| `outline` | Actions secondaires (Voir, Télécharger, Déposer) |
| `plain` | Actions tertiaires (Supprimer) |

### Icônes

`@heroicons/react` — `20/solid` dans l'app, `16/solid` dans menus compacts.  
Toujours `data-slot="icon"` sur les icônes dans les boutons Catalyst.

## Interdictions (enforced par CI)

### `check-catalyst.mjs`

Sur `app/(app)/**` et `components/**` sauf `ui/` et `marketing/` :

- ❌ `<button>`, `<input>`, `<select>`, `<table>` natifs
- ❌ Couleurs Tailwind hors `zinc`, `accent`, `white`, `black`, et `red`/`green` sémantiques

### `check-hardcode.mjs`

Sur `app/`, `components/`, `lib/` sauf `ui/` :

- ❌ Couleurs hex (`#…`)
- ❌ `console.log`
- ❌ `as any`
- ❌ Secrets en dur

## Zones hors design system strict

| Zone | Raison |
|------|--------|
| `components/ui/` | Source Catalyst |
| `components/marketing/` | Landing publique (dégradés décoratifs autorisés) |
| `app/(site)/` | Hors scope catalyst (pas de `(app)` dans le path scanné) |

## Graphiques institutionnels (`components/charts/`)

Graphiques construits avec **Visx** (Airbnb) pour allier la puissance de D3 et la propreté de React.
Palette strictement `accent-*` + `zinc-*`, chiffres en `tabular-nums`.

| Composant | Usage |
|-----------|--------|
| `ChartSurface` | Encadrement titre + description (figure sémantique) |
| `CumulativeCashChart` | Barres annuelles + ligne cumulative (Data Center cash-flow) |
| `SensitivityBarChart` | Barres horizontales MOIC (sensibilité multiple de sortie) |
| `ScenarioComparisonChart` | Colonnes MOIC (comparaison scénarios) |
| `AnnualMetricChart` | Barres annuelles (Mining EBITDA) |
| `BulletChart` | KPI overview (complétude KYC, MOIC, IRR) |

Échelles partagées : `lib/charts/scale.ts`, format axes : `lib/charts/format.ts`.

## Dark mode

`prefers-color-scheme` via CSS (`globals.css` + classes `dark:`). Pas de toggle manuel.

## Accessibilité

`npm run check:a11y` — heuristiques de base. Prévoir labels, focus visible Catalyst, `aria-label` sur zones interactives custom.

## Checklist avant merge UI

- [ ] Primitives Catalyst uniquement
- [ ] Couleurs `zinc` + `accent` (+ sémantique statut si besoin)
- [ ] Pas de hex en dur
- [ ] `npm run check` vert

## Références code

- Tokens : `app/globals.css`
- Statuts documents : `components/dossier/document-status-badge.tsx`
- Registre : `components/dossier/registry.tsx`
- Surfaces : `components/ui/surface.tsx`
- Sidebar : `components/dashboard/app-sidebar.tsx`
- Graphiques : `components/charts/`
