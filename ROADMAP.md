# LTA — Live Stream App
## PWA WebRTC Anónima — Next.js + Vercel/Cloudflare
## Roadmap por Etapas — Setup Claro, Bajo Costo, Pivotable

---

## 📊 CONTEXTO & DECISIONES ARQUITECTÓNICAS

### Stack Elegido
- **Frontend:** Next.js 14+ (App Router) + React 19
- **Hosting:** Vercel Business (que ya tenés) + Cloudflare (free tier para WebRTC signaling)
- **WebRTC:** SimplePeer (librería ligera, bien mantenida)
- **Signaling:** Vercel WebSocket inicial → Cloudflare Durable Objects (ETAPA 3)
- **Chat:** WebSocket simple (sin estado persistente en v1)
- **Base de datos:** Ninguna en v1 — todo en memoria/local storage (pivotable a D1/Supabase)
- **Autenticación:** Anónima (UUID en memoria)

### Costos Estimados
- **Vercel:** Ya pagado (Business plan)
- **Cloudflare:** Free tier (100k requests/día, 50ms latency)
- **WebRTC signaling:** 0€ (Cloudflare Workers free)
- **Hosting final:** ~0€ primera fase

---

## 🎯 ETAPAS

### **ETAPA 0: Setup Base & Scaffold** (3h)
- Crear repo Next.js limpio
- Deploy inicial a Vercel
- Estructura de directorios
- Decisión: Signaling Vercel WebSocket (inicial)

**Entregable:** Repo deployado, estructura lista, PWA manifest + SW

---

### **ETAPA 1: PWA Base + Anónimo** (5h)
- Service Worker + Manifest funcional
- Broadcaster (cámara/micrófono)
- Spectator (reproduce stream)
- Chat básico en vivo
- Custom hooks WebRTC

**Entregable:** PWA anónima funcional, broadcaster transmite, spectators ven/chatean

---

### **ETAPA 2: UX + Persistencia Ligera** (3h)
- Pulir componentes UI
- Stats conexión (latencia, bitrate)
- Responsive design (mobile-first)
- Analytics anónimo
- Preparar pivotaje

**Entregable:** PWA bonita, lista para demo

---

### **ETAPA 3: Chat Privado + Monetización** (6h)
- Chat privado 1v1 entre peers
- Integración Stripe/Lemonsqueezy (tips)
- Upgrade a Cloudflare Durable Objects
- Moderación básica

**Entregable:** Chat privado funcional, listo para monetización

---

### **ETAPA 4: Escalabilidad & Production** (10h)
- Base de datos real (D1 o Supabase)
- STUN/TURN servers robusto
- Monitoring (Sentry, Cloudflare Analytics)
- CI/CD (GitHub Actions)
- Testing E2E (Playwright)

**Entregable:** PWA listo para 1000+ usuarios simultáneos

---

## 📋 TIMELINE

| Etapa | Horas | Estado |
|-------|-------|--------|
| 0 | 3 | ⏳ Próximo |
| 1 | 5 | ⏳ |
| 2 | 3 | ⏳ |
| 3 | 6 | ⏳ |
| 4 | 10 | ⏳ |
| **TOTAL** | **27h** | ~2 semanas |

---

## 🎛️ DECISIONES REQUERIDAS

1. **Nombre/Dominio:** `livestream.pendziuch.com` ¿o nuevo?
2. **Monetización v1:** ¿Tips/tipping desde el inicio o ETAPA 3?
3. **Scope v1:** ¿Incluir geolocación? ¿Grabar? → NO en v1
4. **Quién arranca:** ¿Tú + V0 para UI? ¿Freelance?

---

## 📚 ESTRUCTURA LTA

```
LTA/
├── ROADMAP.md (este archivo)
├── ETAPA_0_SETUP.md (comandos, configs, checklist)
├── ARCHITECTURE.md (decisiones técnicas, diagrama)
├── CODE_EXAMPLES/ (snippets reutilizables)
└── PROYECTO/ (cuando esté creado el repo Next.js)
    └── livestream-pwa/ (acá va el código)
```

---

**¿Aprobás roadmap? ¿Empezamos ETAPA 0 mañana?**
