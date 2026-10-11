# Arquitectura inicial

La solución se organiza como un monorepo npm con límites explícitos entre frontend, backend y código compartido.

El frontend agrupa cada capacidad de negocio en un módulo independiente. Los servicios transversales se ubicarán en `core`; los adaptadores de IndexedDB, SQLite y sincronización se ubicarán en `infrastructure`. Esta separación permitirá que la lógica de aplicación no dependa de una tecnología de almacenamiento concreta.

El backend Node.js y PostgreSQL se implementarán en una fase posterior. La sincronización se diseñará con identificadores estables, marcas de tiempo, operaciones idempotentes y una estrategia explícita de resolución de conflictos.
