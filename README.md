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

## Agentes y modelos

Cada agente se ejecuta como un proceso independiente con [GitHub Copilot
CLI](https://docs.github.com/copilot). Los modelos se cargan **bajo demanda**
desde el botón «Recargar modelos» en el formulario de agente; no hay lista por
defecto.

## Cómo funciona

Un plugin de Vite ([`server/vite-plugin.ts`](server/vite-plugin.ts)) sirve el
frontend y orquesta los agentes sin servidor backend separado. Al enviar una
consulta, el navegador hace `POST /api/run` y recibe un stream NDJSON con los
eventos en tiempo real. El servidor lanza un proceso `copilot -p` por agente y
traduce sus respuestas a estados (`thinking → responding → finished`/`error`).
Cancelar detiene los procesos automáticamente.

### Flujo de ejecución

```mermaid
graph TD
    A["👤 Usuario escribe consulta"] --> B["📤 POST /api/run + listaAgentes"]
    B --> C["🔀 Backend recibe consulta"]
    C --> D{"Para cada agente"}
    D --> E["🚀 Lanza copilot -p"]
    E --> F["💭 Copilot procesa\n+prompt del agente\n+skills"]
    F --> G["📡 Streaming JSONL\ncopilot → servidor"]
    G --> H["🔄 Servidor traduce eventos"]
    H --> I["starting\nthinking\nresponding"]
    I --> J["📊 Streaming NDJSON\nservidor → navegador"]
    J --> K["🎨 Frontend actualiza\nUI en tiempo real"]
    K --> L["✅ Agente termina"]
    L --> M["📝 Respuesta final\nvisible al usuario"]
    N["⏹️ Usuario cancela"] --> O["🛑 AbortController\nmata procesos"]
    style A fill:#1e293b
    style K fill:#3b82f6
    style M fill:#10b981
    style O fill:#ef4444
```

## Configuración de agentes

Crea, edita y elimina especialistas desde la UI (hasta 8). Las plantillas de
agente viven en **`.agents/*.md`** y los skills reutilizables en **`.skills/*.md`**
(ambos trackeados en git). El equipo actual se guarda en **`.tmp/agent.config.json`**
(no versionado). Detecta y carga `.md` automáticamente.

Las skills soportan un campo opcional **`applyTo`** en el frontmatter (mismo
estándar que usa GitHub Copilot para instrucciones específicas de path):
patrones glob separados por comas que indican a qué archivos aplica, p.ej.
`applyTo: "**/*.java, **/pom.xml"`. Es metadata informativa — no filtra
automáticamente, es una guía visible en la UI al armar el equipo.

## Estructura

- **`.agents/`** — plantillas de agente (`.md`)
- **`.skills/`** — skills reutilizables (`.md`)
- **`.tmp/`** — estado local en runtime (no versionado)
- **`server/`** — plugin Vite: API y orquestación de Copilot CLI
- **`src/`** — frontend React + Tailwind

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
