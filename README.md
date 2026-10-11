# CAFETERÍA ESCOLAR

Base técnica de una plataforma modular y offline-first para cafeterías escolares. La solución está preparada para crecer como aplicación web responsive y aplicación Android mediante Capacitor.

## Tecnologías de esta fase

- React + TypeScript + Vite
- Tailwind CSS
- Capacitor para Android
- npm workspaces

La integración con IndexedDB, SQLite, Node.js y PostgreSQL se implementará en fases posteriores.

## Estructura

```text
apps/
  frontend/       Aplicación React y contenedor Capacitor
  backend/        Backend Node.js (reservado)
packages/
  shared/         Contratos y utilidades compartidas
docs/             Documentación técnica
```

Los módulos funcionales iniciales se encuentran en `apps/frontend/src/modules`:

- `pos`: punto de venta.
- `administration`: administración.
- `inventory`: inventarios.

## Requisitos

- Node.js 22 o superior
- npm 10 o superior
- Para compilar Android en una fase posterior: Android Studio y un JDK compatible con Capacitor

## Desarrollo

Desde `D:\Proyectos\Cafeteria-Escolar`:

```powershell
npm install
npm run dev
```

Vite mostrará la URL local del servidor de desarrollo.

## Verificación

```powershell
npm run typecheck
npm run build
```

## Caché y dependencias

La configuración `.npmrc` mantiene la caché de npm en `.npm-cache`, dentro del repositorio en D. `node_modules`, la caché y los artefactos de compilación están excluidos de Git.

Antes de ejecutar una compilación Android, mantén también la caché de Gradle en D durante esa sesión de PowerShell:

```powershell
$env:GRADLE_USER_HOME = 'D:\Proyectos\Cafeteria-Escolar\.gradle'
```

La compilación Android no se ejecuta en esta fase, por lo que todavía no se ha generado una caché de Gradle.
