# Office Agents — comandos para ejecución local.
# Uso: `make <objetivo>`. Sin argumentos muestra esta ayuda.

.DEFAULT_GOAL := help
.PHONY: help check install setup dev build preview lint clean reset

## help: Lista los objetivos disponibles
help:
	@echo "Office Agents — objetivos disponibles:"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /'

## check: Verifica los requisitos (Node y Copilot CLI)
check:
	@echo "› Node:    $$(node --version 2>/dev/null || echo 'NO ENCONTRADO')"
	@command -v copilot >/dev/null 2>&1 \
		&& echo "› Copilot: $$(copilot --version 2>/dev/null | head -1)" \
		|| { echo "› Copilot: NO ENCONTRADO en PATH"; \
		     echo "  Instala GitHub Copilot CLI y autentícate antes de usar la app."; }

## install: Instala las dependencias (npm install)
install:
	npm install

## setup: Verifica requisitos e instala dependencias
setup: check install
	@echo "✓ Listo. Arranca con: make dev"

## dev: Arranca la app en local (frontend + API) en http://localhost:5173
dev:
	npm run dev

## build: Type-check y build de producción del frontend
build:
	npm run build

## preview: Sirve el build de producción (npm run preview)
preview:
	npm run preview

## lint: Ejecuta Oxlint
lint:
	npm run lint

## clean: Elimina artefactos de build (dist)
clean:
	rm -rf dist

## reset: Limpieza total (dist + node_modules)
reset: clean
	rm -rf node_modules
