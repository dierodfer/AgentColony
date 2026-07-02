# AgentColony

[![CI](https://github.com/dierodfer/AgentColony/actions/workflows/ci.yml/badge.svg)](https://github.com/dierodfer/AgentColony/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![GitHub Copilot CLI](https://img.shields.io/badge/GitHub%20Copilot-CLI-000000?logo=githubcopilot&logoColor=white)

Aplicación web **local** que ejecuta hasta **8 agentes de GitHub Copilot CLI en
paralelo** y muestra **todas** sus respuestas a la vez, en una cuadrícula dark y
minimalista. Escribes una consulta y ves cómo responde cada agente según su
configuración (modelo, plantilla y skills).

> ⚠️ Pensada para **ejecución local** con `npm run dev`. No está diseñada para
> desplegarse en producción ni expuesta a internet: orquesta procesos de
> `copilot` en tu máquina.

---

## Tabla de contenidos

- [Requisitos](#requisitos)
- [Puesta en marcha](#puesta-en-marcha)
- [Agentes y modelos soportados](#agentes-y-modelos-soportados)
- [Cómo funciona](#cómo-funciona)
- [Configuración de agentes](#configuración-de-agentes)
- [Tarjetas de agente](#tarjetas-de-agente)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Scripts](#scripts)
- [Solución de problemas](#solución-de-problemas)

---

## Requisitos

| Requisito | Versión / nota |
|-----------|----------------|
| **Node.js** | `20+` |
| **npm** | incluido con Node |
| **[GitHub Copilot CLI](https://docs.github.com/copilot)** (`copilot`) | instalado, en el `PATH` y **autenticado**. Requiere una suscripción activa de GitHub Copilot. |

Comprueba que tienes todo con:

```bash
node --version      # >= 20
copilot --version   # debe responder
make check          # verifica Node + Copilot CLI de una vez
```

La app **no gestiona credenciales**: usa la sesión ya autenticada de tu
`copilot` local. No hay tokens ni claves en este repositorio.

## Puesta en marcha

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>.

Con `make`:

```bash
make setup   # verifica requisitos + npm install
make dev     # arranca la app
```

## Agentes y modelos soportados

**Runner soportado:** [GitHub Copilot CLI](https://docs.github.com/copilot). Cada
agente se ejecuta como un proceso independiente `copilot -p`, lo que permite
mezclar modelos y personas en la misma ronda.

**Modelos disponibles:** la lista se obtiene **de Copilot CLI y bajo demanda**.
En el formulario de agente hay un botón **«Recargar modelos»** que ejecuta el
slash-command `/model` dentro de `copilot` (así es como el CLI lista los
modelos) y rellena el selector con lo que devuelve
([`server/models.ts`](server/models.ts)). No se consulta automáticamente al
arrancar: el selector empieza **vacío** hasta que pulsas el botón, y la lista
resuelta se cachea durante la sesión.

> Requiere una instalación de `copilot` funcional y autenticada. Si falla, el
> botón muestra el error y el selector queda vacío; **no hay lista por defecto**.

## Cómo funciona

Un **único proceso de Vite** sirve el frontend y, mediante un plugin
([`server/vite-plugin.ts`](server/vite-plugin.ts)), expone la API y orquesta los
agentes. No hay servidor backend separado.

```
vite (un proceso)
 ├─ Frontend React + Tailwind (src/)
 └─ Plugin officeApiPlugin (server/)
     ├─ /api/models | /api/skills | /api/templates  (catálogos)
     ├─ /api/agents  (CRUD del equipo → .tmp/agent.config.json)
     └─ /api/run     (POST con streaming NDJSON de una ronda)
```

Al preguntar, el navegador hace `POST /api/run` y lee un stream **NDJSON** (un
evento por línea). El servidor lanza un proceso `copilot -p` por agente, traduce
los eventos JSONL de Copilot a estados (`idle → starting → thinking →
responding → finished`/`error`) y los reenvía en vivo. Cancelar = abortar la
petición (`AbortController`); el servidor detecta el cierre y mata los procesos.

## Configuración de agentes

Desde la pantalla de Agentes se pueden crear, editar y eliminar especialistas
(hasta 8). El formulario incluye un botón `↺` que asigna nombre e icono
aleatorio al nuevo agente.

- **`.agents/*.md`** — plantillas de agente (persona). Frontmatter `name` +
  cuerpo markdown con las instrucciones.
- **`.skills/*.md`** — skills reutilizables. Frontmatter `name` + cuerpo.
- **`.tmp/agent.config.json`** — el equipo actual. Es **estado local en
  runtime** (no se versiona): la app lo genera en `.tmp/` la primera vez que
  creas un agente desde la UI.

Todo esto es **contenido local del usuario y no se versiona** (`.agents/`,
`.skills/` y `.tmp/` están en `.gitignore`). Un clon nuevo arranca sin
plantillas, skills ni equipo: los creas desde la UI (que escribe los `.md` en
`.agents/`/`.skills/` y el equipo en `.tmp/`, creando las carpetas si faltan) o
añadiendo tus propios `.md`. La app las detecta automáticamente.

## Tarjetas de agente

Cada agente se muestra en una tarjeta con:

- **Estado en tiempo real** — badge (`idle`, `thinking`, `responding`, `finished`, `error`).
- **Modelo y skills** — el modelo con su icono de acento; las skills colapsadas en un botón `N skills ▾`.
- **Contador de duración** — arranca al empezar y se congela al terminar.
- **Tokens** — total (in + out) con tooltip que desglosa ambos valores.
- **Respuesta** — streaming en vivo con cursor animado; texto final al completar.

## Estructura del proyecto

```
AgentColony/                (·) = local, no versionado (.gitignore)
├─ .agents/ (·)        Plantillas de agente (persona) — *.md
├─ .skills/ (·)        Skills reutilizables — *.md
├─ .tmp/    (·)        Estado local en runtime — agent.config.json
├─ server/             Plugin de Vite: API + orquestación de Copilot CLI
│  ├─ vite-plugin.ts   Rutas /api/* y streaming NDJSON
│  ├─ copilot-runner.ts  Lanza y traduce los procesos `copilot -p`
│  ├─ models.ts        Modelos (recarga bajo demanda vía `copilot` /model)
│  └─ ...
├─ src/                Frontend React + Tailwind
├─ vite.config.ts
└─ Makefile            Atajos: setup, dev, build, lint, check
```

## Scripts

| Script | Acción |
|--------|--------|
| `npm run dev` | Arranca Vite (frontend + API) |
| `npm run build` | Type-check (`tsc -b`) + build de producción del frontend |
| `npm run lint` | Oxlint |
| `npm run preview` | Sirve el build de producción |

## Solución de problemas

- **`copilot: command not found`** → instala [GitHub Copilot CLI](https://docs.github.com/copilot) y asegúrate de que está en el `PATH`.
- **Los agentes fallan al instante (`error`)** → tu sesión de Copilot no está autenticada o no tienes suscripción activa. Verifica con `copilot --version` y vuelve a iniciar sesión.
- **Un modelo no responde** → puede no estar disponible en tu cuenta; prueba con `auto` o revisa `server/models.ts`.
- **El puerto 5173 está ocupado** → Vite elegirá otro puerto; mira la URL que imprime al arrancar.
