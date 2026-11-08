# Touch Grass

Application Nuxt 4 déployée en site statique sur GitHub Pages. Le catalogue satellite passe par le Worker Cloudflare `keeptrack-proxy` ; la clé KeepTrack reste un secret du Worker et n'est jamais incluse dans le site.

## Développement local

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Le Worker autorise `http://localhost:3000` pour les essais locaux.

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` génère le site sous le sous-chemin du dépôt et le publie à chaque push sur `main`. Dans les paramètres GitHub du dépôt, choisir **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Adresse attendue : <https://bureau1217.github.io/head.mmd.workshop.touch_grass.group2/>.

## Worker Cloudflare et clé API

Le Worker est dans le dossier voisin `keeptrack-proxy`. Il lit le secret `KEEPTRACK_KEY` et ne doit jamais recevoir une clé intégrée au site ou à Git.

Depuis ce dossier, définir le secret une seule fois (Cloudflare demande sa valeur dans le terminal), puis déployer le Worker :

```powershell
npx wrangler secret put KEEPTRACK_KEY
npm run deploy
```

Le Worker doit autoriser l'origine `https://bureau1217.github.io` et exposer `GET /sats/brief`. L'URL utilisée par le site est `https://keeptrack-proxy.satp.workers.dev`.

## Vérification locale

```powershell
npx nuxi typecheck
npm run generate
```
