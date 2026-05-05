# LTA — ARCHITECTURE.md
## Decisiones Técnicas & Diagrama

---

## 🏗️ STACK FINAL

```
┌─────────────────────────────────────────────┐
│         PWA (Progressive Web App)           │
│                                             │
│  Next.js 14 (App Router) + React 19        │
│  ├── Tailwind CSS (styling)                │
│  ├── TypeScript (type safety)              │
│  └── Service Worker (offline support)      │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│       WebRTC Signaling & Transport          │
│                                             │
│  SimplePeer (wrapper WebRTC peer)          │
│  ├── ETAPA 0-2: Vercel WebSocket (REST)   │
│  └── ETAPA 3+: Cloudflare Durable Objects  │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│         Hosting & Infraestructura           │
│                                             │
│  Vercel Edge (Next.js, API routes)         │
│  Cloudflare Workers (signaling, escalable) │
│  Cloudflare Analytics (logs anónimos)      │
└─────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────┐
│         Persistencia (Futuro)               │
│                                             │
│  ETAPA 1-2: En-memoria (Map, Array)        │
│  ETAPA 3: IndexedDB (client-side)          │
│  ETAPA 4: Cloudflare D1 (SQLite global)    │
└─────────────────────────────────────────────┘
```

---

## 📊 FLUJO DE DATOS

```
[Broadcaster]
    ↓ getUserMedia()
    ↓ SimplePeer (offer SDP)
    ↓ /api/signaling → almacena offer
    ↓ WebRTC connection établecida
    ↓ MediaStream enviado via P2P
    ↓
[Spectator 1, 2, ..., N]
    ↓ SimplePeer (answer SDP)
    ↓ /api/signaling → recupera offer
    ↓ WebRTC connection P2P
    ↓ Reproduce MediaStream
    
[Chat]
    ↓ SimplePeer.send() → data channel
    ↓ O WebSocket fallback si mobile
    ↓ Broadcast a todos los peers
```

---

## 🎯 DECISIONES CLAVE (POR QUÉ)

### 1. **SimplePeer vs (PeerJS, Agora, Twilio)**
| Criterio | SimplePeer | Alternativas |
|----------|-----------|--------------|
| Costo | FREE | $$$-$$$$$ |
| Tamaño | 8KB | +50KB |
| Control | Total | Limitado |
| Privacidad | Local | Servidor |
| **Veredicto** | ✅ Elegido | ❌ No |

### 2. **Signaling: Vercel WebSocket vs Cloudflare**
**ETAPA 0-2: Vercel WebSocket**
- ✅ Setup rápido, una plataforma
- ✅ Suficiente para <100 usuarios simultáneos
- ❌ WebSocket tiene latencia fallback (REST polling)

**ETAPA 3+: Cloudflare Durable Objects**
- ✅ Global, session-sticky, escalable
- ✅ Free tier robusto
- ✅ Mejor latencia (<50ms)
- ❌ Curva aprendizaje (WASM)

### 3. **Anónimo = UUID en Memoria**
- Sin login (reducir fricción)
- Sin DB (reducir costos)
- Sin tracking (privacidad)
- Pivotable: si user quiere account, lo crea

### 4. **PWA (no app nativa)**
- ✅ iOS + Android sin app store
- ✅ Offline capabilities
- ✅ 1/10 del costo desarrollo
- ✅ Deploy en 1 click (Vercel)

---

## 🔄 PIVOTAJES PLANEADOS

### Monetización (ETAPA 3)
```
Opción A: Tips/Tipping
├── Integrar Stripe (2.9% + $0.30)
└── O Lemonsqueezy (5.6% + $0 mínimo)

Opción B: Premium Features
├── Grabación de streams
├── 1v1 private chat
└── Custom branding
```

### Persistencia (ETAPA 4)
```
Actual (v1-2):        En-memoria (Map/Set)
        ↓
Después (v3):         IndexedDB (client)
        ↓
Production (v4):      Cloudflare D1 (SQLite)
                      + Supabase (alternativa)
```

### Escalabilidad (ETAPA 3+)
```
Actual:       Vercel → 1 región
        ↓
Cloudflare:   Durable Objects → 200+ edge locations
        ↓
Result:       <50ms latencia global
```

---

## 🚫 QUÉ NO HACEMOS EN v1

| Feature | Razón | Etapa |
|---------|-------|-------|
| Geolocación | Privacidad + complejidad | 4+ |
| Grabar streams | Almacenamiento + costos | 4+ |
| Login/Auth | Fricción, MVP anónimo | 3 |
| Moderation AI | Costo + overhead | 4+ |
| Mobile app nativa | PWA = 10x más rápido | Never |
| Analytics tracking | Privacy-first approach | Never |

---

## 💰 COSTOS POR ETAPA

| Etapa | Vercel | Cloudflare | D1/Supabase | **Total** |
|-------|--------|-----------|-------------|----------|
| 0-2 | Included | FREE | — | **$0** |
| 3 | Included | FREE | — | **$0** |
| 4 | Included | FREE | FREE | **$0** |
| **Scale** (10k users) | ~$200 | FREE | ~$20 | **~$220** |

---

## ✅ VERIFICACIÓN TÉCNICA

Antes de ETAPA 1:
- [ ] Next.js 14+ compila sin errores
- [ ] Service Worker registra correctamente
- [ ] Manifest PWA válido
- [ ] SimplePeer instalado y importable
- [ ] Types TypeScript correctos
- [ ] Vercel deployment automático funciona

---

**Próximo: ETAPA 1 (PWA Base) → Broadcaster + Spectator funcionales**
