# Configuration fournisseurs

Les deux fournisseurs sont consommés par l'agent dans `apps/web/lib/agent/store-creator.ts` via les clients `apps/web/lib/suppliers/{aliexpress,cj}.ts`. Les deux APIs tournent en parallèle (`Promise.allSettled`) ; si l'une renvoie 0 produit, l'autre prend le relais. Si les deux échouent, l'agent passe en génération pure Claude.

## AliExpress Open Platform (DS API)

1. Créer un compte développeur : <https://open.aliexpress.com/>
2. Créer une application avec la permission group **AliExpress-dropship** (DS API, pas Affiliate).
3. Récupérer **App Key** + **App Secret** et les pousser dans Vercel :
   - `ALIEXPRESS_APP_KEY`
   - `ALIEXPRESS_APP_SECRET`
4. Console AliExpress : laisser **IP Whitelist vide** (Vercel a des IPs dynamiques).
5. Configurer le **Callback URL** sur l'alias prod (ex: `https://dropship-platform-amber.vercel.app/api/aliexpress/oauth/callback`).
6. Une fois déployé, ouvrir `GET /api/aliexpress/oauth/start` une seule fois pour autoriser l'app et stocker l'access/refresh token en DB (`platform_settings`). Le refresh est automatique ensuite.

API utilisée : `aliexpress.ds.text.search`. Le client demande `currency=EUR, countryCode=FR, local=fr_FR` pour avoir des prix en euros directement utilisables comme `cost_eur`.

Diagnostic : `GET /api/aliexpress/test-search?keywords=...` (sonde 3 méthodes DS/Affiliate avec le token courant).

## CJ Dropshipping

1. Créer un compte sur <https://cjdropshipping.com/>.
2. Aller dans **Account Settings → Developer** et **générer une vraie API Key** (chaîne hex). Le champ `password` de l'API CJ attend cette key, pas le mot de passe du compte (sinon erreur `1600005 - APIkey is wrong`).
3. Ajouter dans Vercel :
   - `CJ_DROPSHIPPING_EMAIL` (email du compte)
   - `CJ_DROPSHIPPING_API_KEY` (la key générée à l'étape 2)

Le client `apps/web/lib/suppliers/cj.ts` gère l'access token (cache 1h) et la recherche `POST /product/list`.

## Test

```bash
# Diagnostic AliExpress (token requis dans platform_settings)
curl 'https://<host>/api/aliexpress/test-search?keywords=yoga+mat'

# Pipeline complet (collection)
curl -N -X POST 'https://<host>/api/agent/create-store' \
  -H 'Content-Type: application/json' \
  -d '{"niche":"yoga","storeName":"Test","mode":"collection","maxProducts":6,"language":"fr"}'

# Mono-produit + assets auto (hero/cutout/3 lifestyles/vidéo)
curl -N -X POST 'https://<host>/api/agent/create-store' \
  -H 'Content-Type: application/json' \
  -d '{"niche":"yoga mat","storeName":"Mono Test","mode":"mono","language":"fr"}'
```

## Socle fournisseurs (V1 + V2 + gouvernance)

### Matrice des fournisseurs

#### V1 — fournisseurs principaux

| Fournisseur | Statut | Auto-forward | Realite API | CONFIRMER avant go-live |
|---|---|---|---|---|
| **AliExpress** | active | oui (`placeOrder` via DS API) | `aliexpress.ds.text.search`, OAuth token dans `platform_settings` (refresh auto GitHub Actions) | IP whitelist vide sur console AliExpress (Vercel IPs dynamiques) |
| **CJ Dropshipping** | active | oui (flow en deux phases : `createOrderV2` puis `confirm`) | Access token cache 1h, `POST /product/list` | Pas d auto-pay : la confirmation de commande est une etape distincte — ne pas fusionner les deux appels |
| **Zendrop** | active | oui (si `placeOrder` implemente) | Transport MCP JSON-RPC, OAuth PKCE via `/api/zendrop/oauth/start`, tokens dans `platform_settings` (`zendrop_access_token`, `zendrop_refresh_token`) | **CONFIRMER les noms exacts des outils MCP Zendrop** (ils varient selon la version du serveur MCP) avant toute commande live |
| **Spocket** | search_only | non | Recherche produits via API ; pas d endpoint commande headless publiquement documente | Fulfillment 100% manuel via dashboard Spocket ; prevoir un workflow operateur |
| **Syncee** | feed-only | non | Import de feed uniquement | Passer `isDropshipDirect=true` dans chaque requete pour filtrer les lots grossistes ; commandes manuelles |

#### V2 — fournisseurs secondaires

| Fournisseur | Statut | Auto-forward | Realite API | CONFIRMER avant go-live |
|---|---|---|---|---|
| **BigBuy** | active | oui (flow check->create) | Verifier la disponibilite avant creation commande | Valider le format exact du payload `create` et la gestion des erreurs de stock |
| **Wholesale2B** | feed-only | non | Import de feed CSV/XML | Pas d API commande — fulfillment manuel |
| **Doba** | feed-only | non | Feed produits ; mecanisme de signature de requete + prepay | **CONFIRMER** le schema de signature et les conditions de prepay avec la doc API Doba avant activation |
| **Inventory Source** | feed-only | non | Import de feed uniquement | Pas d API commande documentee — fulfillment manuel |

#### AutoDS — couche d'automatisation (pas un fournisseur)

`lib/automation/autods.ts` est un **order-forwarder** qui peut router les commandes vers AutoDS comme intermediaire. Ce n'est pas un fournisseur de catalogue : il ne contribue pas a `searchAllSuppliers`. Gated par `AUTODS_ROUTING_ENABLED=1` (OFF par defaut). Token OAuth stocke dans `platform_settings` sous la cle `autods_api_token` via `STORE_SECRETS_KEY`.

### Gouvernance — politique dropship-pur

Fichier source : `apps/web/lib/suppliers/policy.ts`

**EXCLUDED_PLATFORMS** — blocklist absolue (jamais enregistrable comme fournisseur actif) :
`alibaba`, `1688`, `taobao`, `indiamart`, `tradeindia`, `exportersindia`, `turkishexporter`, `made-in-china`, `local-no-api`.
Ces plateformes sont exclues pour MOQ / modele grossiste / absence de fulfillment unitaire.

**`assertDropshipPure(s)`** — gate fail-closed appliquee au sourcing. Valide les trois criteres durs :
- `unitOrder` — commande unitaire possible (pas de MOQ)
- `noStock` — modele no-stock, pas d achat de lot
- `directShip` — expedition directe au client final en neutre

Un fournisseur qui echoue sur un seul de ces trois criteres est bloque avec une erreur explicite.

**`canAutoForward(s)`** — retourne `true` uniquement si `s.status === 'active'` ET `s.placeOrder` est une fonction. Les fournisseurs `feed-only` et `search_only` sont exclus du forwarding automatique.

**`activeSourcingSuppliers()`** — liste les fournisseurs autorises comme sources de produits (ceux qui passent `evaluateDropshipPure`). Utilise par `searchAllSuppliers` pour le fan-out.

**`searchAllSuppliers(params, opts)`** — fan-out `Promise.allSettled` sur `activeSourcingSuppliers()` (ou un sous-ensemble via `opts.only`). Agregation des resultats ; les erreurs individuelles ne bloquent pas les autres fournisseurs.

### Migrations a appliquer manuellement contre Railway

Les trois migrations suivantes (dans `infra/postgres/`) doivent etre appliquees avec `psql "$DATABASE_URL" -f infra/postgres/<fichier>.sql` avant tout deploiement utilisant le socle V1/V2 :

| Fichier | Objet |
|---|---|
| `031_order_forward_supplier.sql` | Tracking du fournisseur utilise pour chaque forward de commande |
| `032_dropship_suppliers.sql` | Table de configuration des fournisseurs enregistres |
| `033_supplier_catalog.sql` | Cache catalogue produits multi-fournisseurs |

Chacune dispose d un `.down.sql` pour rollback.

### Etat des tests

Toute la suite de tests fournisseurs est mockee via **MSW** (fail-closed par defaut, cf. `test/setup-msw.ts`). Les handlers MSW de chaque fournisseur (ex. `bigbuy.test.ts`, `zendrop.test.ts`, etc.) retournent des fixtures statiques. Resultat : `npm test` passe au vert **sans aucune cle live**. Le cablage live se fait uniquement via les variables d'env documentees dans `apps/web/env.example`.

---

## Mode mono-produit + génération d'assets

Le mode `mono` ajoute deux étages au pipeline :

1. **Filtre vision Claude** — chaque image fournisseur passe devant `claude-haiku-4-5` qui rejette les écritures, prix sur l'image, badges `-10%`, watermarks, collages multi-produits, mains/visages humains. Code : `apps/web/lib/agent/image-quality.ts`. Coût ~$0.001 par image. Seuil mono = 0.65, collection = 0.5.

2. **Asset generator** — après l'import du SKU dans Medusa, l'agent appelle ComfyUI (via Comfy Deploy ou un instance local) pour générer hero / cutout / 3 lifestyles / vidéo promo 5s. Code : `apps/web/lib/agent/asset-generator.ts`. Sortie : `apps/web/public/generated/{slug}/run-{ts}-flux-kontext/` + symlink `current/`. Les chemins web sont stockés dans `dropship_stores.{hero_image_url, cutout_image_url, lifestyle_images, promo_video_url}` et consommés par `MonoProductLanding.tsx`.

### Variables d'env (asset generation)

- `COMFY_DEPLOY_API_KEY` — clé API cloud.comfy.org. Si absente, fallback local.
- `COMFY_DEPLOY_API_URL` (optionnel) — défaut `https://api.comfydeploy.com/api`.
- `COMFY_DEPLOYMENT_HERO`, `COMFY_DEPLOYMENT_CUTOUT`, `COMFY_DEPLOYMENT_LIFESTYLE` — IDs de deployment cloud.comfy.org pour chaque type d'asset (FLUX Kontext recommandé).
- `COMFY_DEPLOYMENT_VIDEO` — deployment image-to-video (CogVideoX / Wan2.1 i2v). Optionnel : si absent, vidéo skipée.
- `COMFYUI_URL` — URL d'un ComfyUI self-hosted (utilisé seulement si `COMFY_DEPLOY_API_KEY` absent).
- `NEXT_PUBLIC_BASE_URL` — utilisé pour résoudre l'URL absolue du cutout passée à la step vidéo.

Si aucune variable Comfy n'est configurée, l'agent termine quand même et le store fonctionne avec l'image fournisseur brute (warning loggé).

### Production : stockage des assets

Vercel n'a pas de filesystem persistant en runtime. Pour le moment les assets sont écrits dans `public/generated/` ce qui marche en dev. En prod il faut soit (a) commit-and-deploy les assets générés (workflow brisa actuel), soit (b) ajouter un backend S3/R2 dans `comfy-client.ts:fetchBinary` pour pousser direct vers un bucket et stocker l'URL absolue. Voir TODO en bas de `asset-generator.ts`.
