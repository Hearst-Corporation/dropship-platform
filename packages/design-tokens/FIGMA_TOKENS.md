# Figma Token Structure

Maps every token in this system to its Figma Variables equivalent.
Use **Token Studio** or **Tokens Studio for Figma** to sync.

## Collection Architecture

### Collection 1: Primitives
*Modes: single*

| Group | Examples |
|-------|---------|
| color/neutral | 0 → 1000 (21 steps) |
| color/primary | 25 → 950 (12 steps) |
| color/violet | 25 → 950 |
| color/cyan | 25 → 950 |
| color/emerald | 25 → 950 |
| color/amber | 25 → 950 |
| color/red | 25 → 950 |
| color/gold | 25 → 950 |
| color/neon-green | 400/500/600 |
| color/neon-blue | 400/500/600 |
| color/neon-purple | 400/500/600 |
| spacing/base | 0, px, 0.5 → 96 |
| radius/scale | none, xs, sm, md, lg, xl, 2xl, 3xl, 4xl, full |
| font/family | sans, display, mono, serif |
| font/size | display-2xl → mono-xs |
| font/weight | light → black |
| font/lineHeight | none → code |
| font/letterSpacing | tighter → overline |

### Collection 2: Semantics
*Modes: Light, Dark, AMOLED, Luxury, Glass, Enterprise, Neon, Mono*

All values **alias** Primitive collection tokens.
No raw values — only references.

| Group | Token |
|-------|-------|
| bg/canvas | → primitive.color.neutral.25 (light) |
| bg/primary | → primitive.color.neutral.0 (light) |
| text/primary | → primitive.color.neutral.900 (light) |
| text/secondary | → primitive.color.neutral.600 (light) |
| border/default | → primitive.color.neutral.200 (light) |
| brand/primary | → primitive.color.primary.500 |
| status/success | → primitive.color.emerald.500 |
| ... | ... |

### Collection 3: Components
*Modes: Default, Compact, Spacious*

Alias Semantic collection tokens.
Override per-component only what differs from semantic.

| Component | Tokens |
|-----------|--------|
| button | height, paddingX, radius, bg, text, hoverBg |
| input | height, radius, border, focusRing, placeholder |
| card | padding, radius, bg, border, shadow |
| badge | height, padding, radius, fontSize |
| avatar | sizes (6 steps), shape, ring |
| modal | padding, radius, shadow, overlayOpacity |
| sidebar | width, collapsedWidth, itemHeight, groupLabelSize |

### Collection 4: Motion
*Modes: Full, Reduced, None*

| Group | Tokens |
|-------|--------|
| duration | 75ms → 1500ms |
| easing | spring, smooth, smooth-out, smooth-in, ... |

## Figma Variables Format (JSON)

```json
{
  "$schema": "https://stepsci.com/token-schema/1.0.0/schema.json",
  "Primitives": {
    "color": {
      "neutral": {
        "0":   { "$value": "#ffffff", "$type": "color" },
        "50":  { "$value": "{Primitives.color.neutral.0}", "$type": "color" },
        "500": { "$value": "#676974", "$type": "color" }
      },
      "primary": {
        "500": { "$value": "#4F46E5", "$type": "color" }
      }
    },
    "spacing": {
      "4": { "$value": "16", "$type": "dimension" }
    }
  },
  "Semantics": {
    "bg": {
      "canvas": {
        "$value": "{Primitives.color.neutral.25}",
        "$type": "color"
      }
    },
    "text": {
      "primary": {
        "$value": "{Primitives.color.neutral.900}",
        "$type": "color"
      }
    },
    "brand": {
      "primary": {
        "$value": "{Primitives.color.primary.500}",
        "$type": "color"
      }
    }
  }
}
```

## Figma Auto Layout Naming Convention

```
Component/[Variant]/[Size]/[State]
e.g. Button/Primary/MD/Default
     Button/Primary/MD/Hover
     Button/Primary/MD/Loading
     Button/Primary/MD/Disabled
     Input/Default/MD/Empty
     Input/Default/MD/Focused
     Input/Error/MD/Filled
     Card/Default/MD
     Card/Glass/LG
     Badge/Success/SM/Dot
```

## Sync Commands (Token Studio)

```bash
# Export tokens to JSON
token-studio export --output tokens/

# Import into Figma
token-studio sync --file hearst-design-system.fig

# Generate CSS variables from Figma tokens
token-studio build --platform css --output src/tokens.css
```

## Interactive States — Figma Prototyping

All interactive components must have these variants at minimum:

1. Default
2. Hover (change: bg, border, shadow)
3. Pressed/Active (change: scale 0.97, deeper color)
4. Focused (change: show focus ring)
5. Disabled (change: opacity 40%, cursor not-allowed)
6. Loading (change: show spinner, disable interaction)
7. Error (change: border-error, shadow-error)
8. Success (change: border-success, icon swap)

Connect with **Smart Animate** transitions, duration 150ms, easing: Ease Out.
