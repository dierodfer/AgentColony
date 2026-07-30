# Plan de categorización y resolución de errores de SonarCloud

Proyecto analizado: [dierodfer_AgentColony](https://sonarcloud.io/project/overview?id=dierodfer_AgentColony)
Datos obtenidos vía API pública de SonarCloud el 2026-07-30.

## 1. Resumen general

| Métrica | Valor | Rating |
|---|---|---|
| Bugs | 5 | Reliability: **B (2.0)** |
| Vulnerabilities | 7 | Security: **C (3.0)** |
| Code Smells | 157 | Maintainability: **A (1.0)** |
| Security Hotspots | 0 | — |
| Duplicación | 1.6% | — |
| Líneas de código (ncloc) | 5.632 | — |
| Deuda técnica (sqale_index) | 841 min (~14h) | — |

**Total de issues abiertos: 169**, repartidos por severidad así:

| Severidad | Nº issues |
|---|---|
| MAJOR | 97 |
| MINOR | 62 |
| CRITICAL | 8 |
| INFO | 2 |

El rating de seguridad (C) es el más preocupante a nivel de "salud" del proyecto, aunque el volumen mayor de issues (91 de 169, el 54%) corresponde a dos reglas mecánicas de bajo riesgo (ver categoría F).

## 2. Categorización de errores

### A. Vulnerabilidades de seguridad (7) — la categoría de mayor riesgo

| Severidad | Regla | Archivo | Línea | Descripción |
|---|---|---|---|---|
| MAJOR | githubactions:S6505 | `.github/workflows/ci.yml` | 19 | `npm ci` sin `--ignore-scripts`: permite ejecutar scripts de ciclo de vida de dependencias de terceros durante la instalación (riesgo de supply-chain). |
| MAJOR | typescript:S2245 | `src/components/AgentEditor.tsx` | 146, 150 | Uso de `Math.random()` (generador pseudoaleatorio no seguro) en contexto sensible. |
| MAJOR | typescript:S2245 | `src/components/AgentIdentity.tsx` | 18 | Ídem. |
| MINOR | tssecurity:S8476 | `src/api.ts` | 20 | Datos "tainted" (no confiables) usados para construir una URL de request sin validar. |
| MINOR | tssecurity:S8475 | `src/hooks/useHistory.ts` | 25 | Datos "tainted" escritos en `localStorage`/almacenamiento del navegador sin sanear. |
| MINOR | typescript:S4036 | `server/cli-adapters.ts` | 431 | La variable `PATH` podría no contener solo directorios fijos y no escribibles (riesgo de hijacking de binarios). |

### B. Bugs funcionales / de accesibilidad (5)

Los 5 bugs son del mismo tipo: `typescript:S1082` — elementos visibles no interactivos con `onClick` que carecen de listener de teclado (accesibilidad real, no solo estilo):
`AgentMapView.tsx:199`, `AgentNode.tsx:112`, `SynthesisPanel.tsx:44`, `UsageSummary.tsx:81` y `:82`.

### C. Complejidad cognitiva crítica (8 code smells, severidad CRITICAL)

Regla `typescript:S3776` — funciones que superan el límite de complejidad cognitiva (15):

| Archivo | Línea | Complejidad actual |
|---|---|---|
| `server/vite-plugin.ts` | 95 | **121** (8x el límite) |
| `server/cli-adapters.ts` | 118 | 24 |
| `server/cli-adapters.ts` | 70 | 20 |
| `src/hooks/useOfficeRun.ts` | 20 | 17 |
| `src/components/AgentIdentity.tsx` | 148 | 18 |
| `src/components/AgentEditor.tsx` | 304 | 16 |
| `src/components/AgentMap/AgentBubble.tsx` | 27 | 16 |
| `src/hooks/useOfficeRun.ts` | 91 | 16 |

### D. Rendimiento / ReDoS en expresiones regulares (7, MAJOR)

Regla `typescript:S8786` — regex con rendimiento superlineal por backtracking (riesgo de Denial of Service si procesan input de usuario/agente).

### E. Accesibilidad estructural (14, MAJOR)

- `typescript:S6848` (5): elementos interactivos no nativos sin rol/soporte de teclado, ratón y touch.
- `typescript:S6853` (4): labels de formulario no asociados a su control.
- `typescript:S3358` (11): ternarios anidados que dañan legibilidad (relacionado indirectamente con mantenibilidad, no accesibilidad, pero se agrupa aquí como "MAJOR de lógica").

### F. Code smells mecánicos de alto volumen (91 issues, el 54% del total)

- `typescript:S9011` (**57**, MAJOR): falta el atributo `type` explícito en `<button>`.
- `typescript:S6759` (**34**, MINOR): props de componentes React no marcadas `readonly`.

Son cambios triviales y automatizables (bajo riesgo, alto impacto en el conteo total).

### G. Resto de code smells menores (~30 issues)

Modernización de JS/TS de bajo impacto: `S6594`/`S7755`/`S7758`/`S7773`/`S7776`/`S7778`/`S7780`/`S7781`/`S6582`/`S6606`/`S6397`/`S4624`/`S6772`/`S6479`/`S2933`/`S1135` (TODO pendiente), repartidas en varios archivos.

## 3. Ranking de prioridad (de mayor a menor importancia)

1. **Vulnerabilidades de seguridad (categoría A — 7 issues).** Impactan directamente el rating de seguridad del proyecto (C) y algunas son explotables (supply-chain en CI, tainted data). Prioridad máxima.
2. **Complejidad cognitiva crítica (categoría C — 8 issues, especialmente `vite-plugin.ts` con 121/15).** Código muy difícil de mantener y con alta probabilidad de esconder bugs; bloquea cualquier cambio futuro seguro en esos archivos.
3. **Bugs de accesibilidad reales (categoría B — 5 issues) + accesibilidad estructural (categoría E — 9 issues de S6848/S6853).** Afectan a usuarios reales (navegación por teclado, lectores de pantalla, formularios).
4. **ReDoS en regex (categoría D — 7 issues).** Riesgo de rendimiento/DoS si el input no está controlado; fix generalmente rápido (reescribir el patrón).
5. **Ternarios anidados y miembros no `readonly` puntuales (parte de categoría E — 11 issues S3358, 1 issue S2933).** Mantenibilidad y legibilidad, sin riesgo funcional.
6. **Code smells mecánicos masivos (categoría F — 91 issues).** Bajo riesgo individual, pero representan más de la mitad del total de issues; automatizables con find-and-replace o codemod, buena relación esfuerzo/beneficio para "limpiar" el dashboard.
7. **Resto de code smells menores (categoría G — ~30 issues).** Modernización de sintaxis sin impacto funcional; se resuelven de forma oportunista.

## 4. Plan de pasos para resolverlos

### Paso 1 — Vulnerabilidades de seguridad (prioridad máxima)
1. `.github/workflows/ci.yml:19`: cambiar `npm ci` por `npm ci --ignore-scripts` (evaluar si algún `postinstall` legítimo se rompe; si es así, añadir una allowlist explícita).
2. `AgentEditor.tsx:146,150` y `AgentIdentity.tsx:18`: sustituir `Math.random()` por `crypto.randomUUID()` o `crypto.getRandomValues()` si el valor generado tiene implicación de seguridad/unicidad (p. ej. IDs); si es solo cosmético (animación, orden aleatorio de UI), documentar el `// NOSONAR` con justificación en vez de silenciar sin más.
3. `src/api.ts:20`: validar/whitelist el origen de los datos antes de construir la URL (evitar SSRF/open redirect en cliente).
4. `src/hooks/useHistory.ts:25`: sanear el dato antes de escribirlo en `localStorage` (evitar XSS almacenado si luego se renderiza sin escapar).
5. `server/cli-adapters.ts:431`: no confiar en `process.env.PATH` heredado; construir el `PATH` explícito para los subprocesos que lanza.

### Paso 2 — Reducir complejidad cognitiva crítica
1. `server/vite-plugin.ts:95` (121→15): dividir la función en sub-funciones con responsabilidad única; es el caso más urgente por la magnitud del exceso.
2. `server/cli-adapters.ts:70` y `:118`: extraer ramas de parsing/adaptación de cada CLI a funciones dedicadas por proveedor.
3. `src/hooks/useOfficeRun.ts:20,91`, `AgentIdentity.tsx:148`, `AgentEditor.tsx:304`, `AgentMap/AgentBubble.tsx:27`: aplicar early-returns, extraer helpers y eliminar anidamiento de condicionales.

### Paso 3 — Corregir bugs y accesibilidad
1. `S1082` (5 bugs): añadir `onKeyDown`/`role="button"`/`tabIndex` a los elementos con `onClick` (`AgentMapView.tsx`, `AgentNode.tsx`, `SynthesisPanel.tsx`, `UsageSummary.tsx`).
2. `S6848` (5) y `S6853` (4): reemplazar elementos no nativos por controles HTML semánticos (`<button>`, `<label htmlFor>`) donde sea posible.

### Paso 4 — Mitigar ReDoS
1. Revisar las 7 expresiones regulares marcadas por `S8786` y reescribirlas sin backtracking exponencial (cuantificadores anidados, alternancias solapadas), o acotar la longitud del input antes de aplicar el regex.

### Paso 5 — Legibilidad de lógica
1. `S3358` (11): extraer los ternarios anidados en variables/if-else explícitos.
2. `S2933` (1): marcar el miembro como `readonly`.

### Paso 6 — Limpieza masiva mecánica (alto volumen, bajo riesgo)
1. `S9011` (57): añadir `type="button"` (o `"submit"`) a todos los `<button>` sin atributo explícito — automatizable con un codemod/regex sobre `src/components/**`.
2. `S6759` (34): marcar las props de los componentes React como `readonly` en sus interfaces/types — automatizable vía ESLint autofix si se activa la regla equivalente localmente.

Archivos con mayor concentración de estas dos reglas (mejor punto de partida): `AgentEditor.tsx` (30 issues totales), `TemplatesView.tsx` (29), `UsageSummary.tsx` (13), `AgentCard.tsx` (11), `AgentIdentity.tsx` (11).

### Paso 7 — Resto de modernizaciones menores
1. Resolver el resto de `S6594`, `S7755`, `S7758`, `S7773`, `S7776`, `S7778`, `S7780`, `S7781`, `S6582`, `S6606`, `S6397`, `S4624`, `S6772`, `S6479` de forma oportunista al tocar cada archivo, o en un PR de limpieza dedicado.
2. Resolver o eliminar el `TODO` marcado por `S1135`.

## 5. Recomendación de proceso

- Añadir `S9011` y `S6759` (paso 6) como reglas de ESLint con `--fix` para evitar que reaparezcan y limpiar el 54% del backlog en un solo PR de bajo riesgo.
- Priorizar un PR dedicado a las 7 vulnerabilidades (paso 1) antes que cualquier otra categoría, dado su impacto directo en el rating de seguridad.
- Añadir un quality gate en SonarCloud (actualmente "NOT COMPUTED") para bloquear la introducción de nuevas vulnerabilidades y bugs en PRs futuros.
