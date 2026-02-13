# CST Manto - Arquitectura actual (localStorage)

## Persistencia
- Modo actual: `localStorage` del navegador.
- Clave: `cst-manto-db-v1`.
- No requiere PostgreSQL para ejecutar el MVP.

## Esquema lógico (equivalente al modelo relacional)

- `users`
- `trucks`
- `yardEntries`
- `maintenanceTypes`
- `truckMaintenanceStates`
- `workOrders`
- `serviceHistory`
- `auditLogs`
- `meta.workOrderSerial`
- `currentActorId`

## Motor de negocio
Implementado en:
- `/Users/johanrojas/Documents/CST-Manto/src/lib/local/service.ts`

Incluye:
- Delta automático de odómetro.
- Detección `DUE / DUE_SOON / OVERDUE`.
- Mantenimiento múltiple en una sola entrada.
- No duplicar órdenes abiertas por `camión + tipo`.
- Reset de contador al completar orden.
- Corrección solo Admin + `AuditLog` + recálculo global.

## Pantallas conectadas a localStorage
- Dashboard: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/page.tsx`
- Registrar Entrada: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/register/page.tsx`
- Camiones: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/trucks/page.tsx`
- Órdenes: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/orders/page.tsx`
- Reportes: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/reports/page.tsx`

## Usuarios y permisos
- Selector de usuario en UI (`ADMIN`, `OPERATOR`) para simular sesión activa.
- Corrección de odómetro bloqueada para no-admin.

## Exportes
- CSV: generado cliente-side.
- PDF: generado vía ventana de impresión del navegador.
