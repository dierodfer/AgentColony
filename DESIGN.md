# Multiagent — Sistema de diseño (vista simultánea)

Rediseño de la interfaz multiagente. Se elimina por completo el concepto de
**oficina virtual** (avatares humanos, escritorios, personajes) y se sustituye
por una superficie **dark, minimalista y premium** inspirada en Linear, Arc,
Raycast, Notion y OpenAI: especialistas de IA colaborando alrededor de una
petición, todos visibles a la vez.

> El mockup hiperrealista **es la propia app** (React + Tailwind v4). Para verlo:
> `npm run dev` → `http://localhost:5173`. Para una captura tipo Dribbble: abre
> en una ventana de ~1440px, modo oscuro, y captura la pantalla completa.

---

## 1 · Wireframe de alta fidelidad (pantalla principal)

```
┌─────────────┬────────────────────────────────────────────────────────────────┐
│ ◣ Multiagent│                                                                  │
│  Especialistas│  ┌────────────────────────────────────────────────────────┐   │
│             │  │  Plantea una petición a tu equipo…           [ Consultar ]│   │  ← input dominante
│ ▸ Resumen   │  └────────────────────────────────────────────────────────┘   │
│ ▸ Agentes 8 │    Recientes  ⟨¿Cómo mejoramos…⟩ ⟨Auth flow⟩ ⟨…⟩                │
│ ▸ Skills  5 │                                                                  │
│             │   PETICIÓN                                                       │  ← Resumen: la petición
│             │   ¿Cómo estructuramos el backend del proyecto?                   │     es el centro del sistema
│             │   ⟨8 especialistas⟩ ⟨● 3 trabajando⟩ ⟨● 4 completados⟩           │
│             │                                                                  │
│             │   Agentes                                            [ + Añadir ]│
│             │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│             │   │▣ Atlas  ●│ │▣ Nova   ●│ │▣ Orion  ●│ │▣ Vega   ●│   grid     │  ← todos visibles
│             │   │ Backend  │ │ Frontend │ │   QA     │ │   UX     │  4 × N      │     (sin tabs/carrusel)
│             │   │⟨GPT-5.4⟩ │ │ ⟨…⟩      │ │ ⟨…⟩      │ │ ⟨…⟩      │            │
│             │   │⟨API⟩⟨PG⟩ │ │          │ │          │ │          │            │
│             │   │──────────│ │──────────│ │──────────│ │──────────│            │
│  ● en vivo  │   │"Para el…"│ │"Propongo"│ │"Riesgos…"│ │"La jerar"│            │
│             │   └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│             │                                                                  │
│             │   ╔══════════════════════════════════════════════════════════╗ │
│             │   ║ ✦ SÍNTESIS FINAL                                          ║ │  ← jerarquía superior
│             │   ║ 4 especialistas han contribuido a esta conclusión.        ║ │     a cualquier tarjeta
│             │   ║ ┌───────────────────┐ ┌───────────────────┐               ║ │
│             │   ║ │• Atlas · Backend  │ │• Nova · Frontend  │  …            ║ │
│             │   ║ └───────────────────┘ └───────────────────┘               ║ │
│             │   ╚══════════════════════════════════════════════════════════╝ │
│             │                                                                  │
│             │   Skills · 5 en uso                                              │
│             │   ⟨testing 1⟩ ⟨react 1⟩ ⟨ux 1⟩ ⟨short-responses 3⟩ ⟨astro 0⟩    │
└─────────────┴────────────────────────────────────────────────────────────────┘
```

## 2 · Layout

| Zona | Contenido | Notas |
|------|-----------|-------|
| **Sidebar** (`224px`, fija) | Marca + `Resumen · Agentes · Skills` | Compacta, sin más opciones. Nav con scroll-spy (item activo según scroll). |
| **Zona superior** | Input principal a todo el ancho (`max-w-5xl`) | Elemento dominante; Enter envía, Shift+Enter salta línea. Historial en chips. |
| **Resumen** | La petición en grande + chips de estado agregado | La petición es el centro del sistema. |
| **Zona principal** | Grid responsive de tarjetas | `1 → 2 → 3 → 4` columnas (`sm`/`xl`/`2xl`). Todos los agentes a la vez. |
| **Síntesis Final** | Conclusión combinada | Debajo del grid, visualmente más importante. |
| **Skills** | Catálogo con uso por agente | Destino del item «Skills». |

Sin carruseles, paginación, modales para respuestas ni tabs para cambiar de
agente. El único modal es el editor de creación/edición (acción CRUD puntual).

## 3 · Sistema visual

| Token | Valor | Uso |
|-------|-------|-----|
| `bg` | `#0B0F17` | Fondo de la app (+ resplandor de acento muy tenue arriba). |
| `surface` | `#121826` | Tarjetas, input, sidebar. |
| `surface-2` | `#161D2E` | Hover / elevado. |
| `elevated` | `#1A2236` | Modal del editor. |
| `line` | `rgba(255,255,255,.06)` | Bordes hairline. |
| `line-strong` | `rgba(255,255,255,.10)` | Bordes en hover / dashed. |
| `accent` | `#4F7CFF` | Acción primaria, foco, filo de síntesis. |
| Texto | `white/90 · /55 · /40 · /30` | Jerarquía por opacidad, no por color. |

**Tipografía** Inter (400 / 500 / 600). Títulos `600` tracking-tight; cuerpo `400`;
metadatos `500` con `uppercase tracking-wider` en etiquetas.

**Estados** — punto + etiqueta, con `color-mix` para borde/fondo tenue:
`idle` En espera · `starting` Conectando · `thinking` Pensando ·
`responding` Respondiendo · `finished` Completado · `error` Error.
Los estados de trabajo laten suave (`soft-pulse`, 1.8s); nunca animaciones
exageradas.

**Animaciones** 150–250 ms, `easeOut`. Entrada de tarjetas (`opacity`+`y`),
`layout` de Framer Motion al reordenar, caret de streaming. Sin partículas, sin
neón, sin sci-fi.

## 4 · Tarjeta de agente

```
┌─────────────────────────────────────────┐
│ ▣  Atlas                  ✎ 🗑   ● Pensando│  glyph + nombre/especialidad · controles (hover) · estado
│    Backend                                │
│                                           │
│ ◆ GPT-5.4   ⟨API⟩ ⟨PostgreSQL⟩ ⟨Arch⟩     │  chip de modelo + skills
│ ─────────────────────────────────────────│  divisor hairline
│ Para comenzar el proyecto recomiendo      │  RESPUESTA dentro de la tarjeta
│ separar el dominio de la capa HTTP y…   ▍ │  (scroll interno, caret en streaming)
└─────────────────────────────────────────┘
```

- **Identidad — robot animado** (`AgentRobot`, SVG + Framer Motion): cada
  `avatar-N` mapea a un robot-mascota único (color de cuerpo + forma de ojos).
  Animación dirigida por estado: flota/parpadea en reposo, antena que pulsa y
  ojos que escanean al **trabajar**, ojos felices `^^` + rebote + chispa al
  **terminar**, ojos `x` + tinte rojo al **fallar**. Respeta `prefers-reduced-motion`.
- Altura uniforme (`items-stretch`), respuesta con `max-h` + scroll fino.
- Hover: borde se refuerza, fondo a `surface-2`, aparecen editar/eliminar.

## 5 · Pantalla principal completa

Implementada en `src/App.tsx` componiendo: `Sidebar`, `HeroPrompt`, bloque
*Resumen*, `AgentGrid` (`AgentCard`), `Synthesis` y `SkillsPanel`.

## 6 · Mapa de implementación (React + Tailwind)

| Archivo | Rol |
|---------|-----|
| `src/index.css` | Tokens `@theme` (Tailwind v4), fondo, keyframes sutiles. |
| `src/components/Sidebar.tsx` | Barra lateral compacta + scroll-spy. |
| `src/components/HeroPrompt.tsx` | Input dominante + historial. |
| `src/components/AgentGrid.tsx` | Grid responsive, estados loading/empty, card de «añadir». |
| `src/components/AgentCard.tsx` | Tarjeta premium con respuesta embebida. |
| `src/components/AgentIdentity.tsx` | Acentos + `AgentGlyph` (identidad abstracta). |
| `src/components/StatusBadge.tsx` | Indicador de estado. |
| `src/components/Synthesis.tsx` | Síntesis Final. |
| `src/components/SkillsPanel.tsx` | Catálogo de skills + uso. |
| `src/components/AgentEditor.tsx` | Modal de edición (dark). |
| `src/lib/text.ts` | Limpieza de markdown / primera frase. |

La capa de datos (hooks, `api.ts`, `server/`) **no se ha tocado**: el protocolo
de streaming NDJSON y el CRUD siguen igual.

## 7 · Nota sobre la Síntesis

Hoy la síntesis se **compone en cliente** a partir del aporte destacado de cada
especialista (primera frase de cada respuesta `finished`). El componente deja el
*seam* preparado para conectar una llamada de síntesis real (un agente
«sintetizador» en `server/`) si se quiere una conclusión generada por modelo.
