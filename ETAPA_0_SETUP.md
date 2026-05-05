# ETAPA 0: Setup Base — Comandos Iniciales

## 1️⃣ CREAR REPO NEXT.JS

```bash
# En D:\LAB o donde guardes proyectos
npx create-next-app@latest livestream-pwa --typescript --app

# Durante setup, seleccionar:
# ✓ TypeScript: Yes
# ✓ ESLint: Yes
# ✓ Tailwind CSS: Yes
# ✓ src/ directory: No
# ✓ App Router: Yes
# ✓ Import alias: Yes (@/*)

cd livestream-pwa

# Dependencias WebRTC
npm install simple-peer uuid
npm install -D @types/simple-peer
```

## 2️⃣ ESTRUCTURA DIRECTORIOS

```
app/
├── layout.tsx          # PWA meta tags
├── page.tsx            # Home (Transmitir vs Ver)
├── broadcast/[id]/page.tsx
├── watch/[id]/page.tsx
├── api/signaling/route.ts
└── api/broadcasts/route.ts

lib/
├── types.ts
├── webrtc.ts
├── useWebRTC.ts
└── useChat.ts

components/
├── BroadcasterStream.tsx
├── SpectatorView.tsx
└── ChatBox.tsx

public/
├── manifest.json
├── sw.js
└── icons/
```

## 3️⃣ NEXT.CONFIG.JS

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    }];
  },
};
module.exports = nextConfig;
```
## 4️⃣ VERCEL.JSON

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "devCommand": "npm run dev",
  "env": {
    "NEXT_PUBLIC_SITE_URL": {
      "description": "Your site URL",
      "required": true
    }
  },
  "functions": {
    "app/api/**/*.ts": {
      "memory": 512,
      "maxDuration": 300
    }
  }
}
```

## 5️⃣ .ENV.EXAMPLE

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VERCEL_URL=
NEXT_PUBLIC_SIGNALING_URL=http://localhost:3000/api/signaling
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

## 6️⃣ PUBLIC/MANIFEST.JSON

```json
{
  "name": "LTA - Live Stream Anónimo",
  "short_name": "LTA Stream",
  "description": "Transmite y ve streams en vivo de forma anónima",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    }
  ]
}
```

## 7️⃣ PUBLIC/SW.JS (Service Worker)

```javascript
const CACHE_NAME = 'lta-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME));
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
  }
});
```

## ✅ CHECKLIST ETAPA 0

- [ ] Repo creado: `npx create-next-app`
- [ ] Carpeta: `D:\LAB\livestream-pwa`
- [ ] `npm install` completado
- [ ] `npm run build` sin errores
- [ ] Archivos config creados (vercel.json, manifest.json, sw.js)
- [ ] GitHub repo creado
- [ ] Linked a Vercel (auto-deploy)
- [ ] Vercel env vars: `NEXT_PUBLIC_SITE_URL`

## 🚀 RESULTADO ESPERADO

Después de ETAPA 0:
- PWA scaffold deployado en Vercel
- Service Worker registrado
- Estructura lista para ETAPA 1
- 0 costos incurridos
