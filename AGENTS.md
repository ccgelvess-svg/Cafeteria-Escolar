# AGENTS.md

## Alcance

Este repositorio contiene el proyecto **CAFETERÍA ESCOLAR**. Todo archivo del proyecto, dependencia, caché de npm y artefacto de desarrollo debe permanecer dentro de `D:\Proyectos\Cafeteria-Escolar`.

## Arquitectura

- `apps/frontend`: React, TypeScript, Vite, Tailwind CSS y Capacitor.
- `apps/backend`: espacio reservado para el backend Node.js.
- `packages/shared`: contratos y utilidades compartidas entre frontend y backend.
- `docs`: decisiones y documentación técnica.

Los módulos funcionales del frontend viven en `apps/frontend/src/modules`: `pos`, `administration` e `inventory`.

## Reglas de desarrollo

- Mantener separados frontend, backend y código compartido.
- Diseñar nuevas funciones con enfoque offline-first y sincronización posterior.
- No acoplar los módulos de negocio a SQLite, IndexedDB o PostgreSQL; usar adaptadores en infraestructura.
- Aplicar roles y permisos en frontend y backend cuando se implemente seguridad.
- No guardar secretos ni archivos `.env` reales en Git.
- No instalar herramientas globales ni modificar configuraciones del sistema.
- Usar la caché local definida en `.npmrc`; no mover dependencias fuera del repositorio.
- Ejecutar al menos `npm run typecheck` y `npm run build` antes de entregar cambios de código.

## Estado actual

El POS aprobado permanece aislado y no debe modificarse. La fase 3 implementa exclusivamente el panel de administración en `/#/admin`. Mantener intacto el módulo de inventarios hasta aprobación explícita. No implementar todavía persistencia, autenticación real, sincronización, operaciones financieras ni servidor.
