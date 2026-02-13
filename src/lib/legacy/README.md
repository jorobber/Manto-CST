# Código Legacy - Prisma

Esta carpeta contiene código relacionado con Prisma que no se está utilizando actualmente en el proyecto.

El proyecto actualmente usa `localStorage` para persistencia de datos (ver `src/lib/local/`), pero estos archivos se mantienen aquí por si se necesita migrar a Prisma en el futuro.

## Archivos

- `prisma.ts` - Cliente Prisma configurado
- `auth.ts` - Funciones de autenticación con Prisma
- `maintenance-engine.ts` - Motor de mantenimiento con Prisma
- `reporting.ts` - Funciones de reportes con Prisma
- `http.ts` - Helpers HTTP para API routes
- `validators.ts` - Validadores Zod que dependen de tipos Prisma

## Nota

Estos archivos NO se importan ni se usan en el código activo de la aplicación. Si planeas usar Prisma en el futuro, necesitarás:

1. Instalar dependencias: `npm install @prisma/client prisma`
2. Configurar la base de datos PostgreSQL
3. Ejecutar migraciones: `npm run prisma:migrate`
4. Actualizar las importaciones en estos archivos si es necesario
