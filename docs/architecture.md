# CST Manto - Arquitectura actual (localStorage sin login)

## Persistencia y sesión
- Modo actual: `localStorage` del navegador.
- Clave principal: `cst-manto-db-v1`.
- Sin pantalla de login. Se usa usuario local por defecto para operar.
- No requiere PostgreSQL para ejecutar el MVP.

## Esquema lógico
- `users` (incluye `role` y `password` local)
- `trucks`
- `yardEntries`
- `maintenanceTypes`
- `truckMaintenanceStates`
- `workOrders`
- `serviceHistory`
- `truckDocuments`
- `auditLogs`
- `meta.workOrderSerial`
- `currentActorId`

## Motor de negocio
Implementado en:
- `/Users/johanrojas/Documents/CST-Manto/src/lib/local/service.ts`

Incluye:
- Delta automático de odómetro.
- Cálculo de horas trabajadas por entrada (`hora_salida - hora_entrada`).
- Detección `DUE / DUE_SOON / OVERDUE`.
- Mantenimiento múltiple en una sola entrada.
- No duplicar órdenes abiertas por `camión + tipo`.
- Reset de contador al completar orden.
- Corrección solo Admin + `AuditLog` + recálculo global.
- Reversa de orden completada solo Admin.
- Alta de camión solo Admin.
- Ajuste de odómetro de camión solo Admin.
- Gestión documental por camión (PDF + fechas + vencimientos).

## Reglas de mantenimiento vigentes
- Engrase: cada `400` horas trabajadas.
- Cambio de aceite: cada `800` horas trabajadas.
- Los umbrales de aviso (`warningBeforeHours`) son configurables por tipo.

## Pantallas
- Dashboard: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/page.tsx`
- Registrar Entrada: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/register/page.tsx`
- Camiones: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/trucks/page.tsx`
- Órdenes: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/orders/page.tsx`
- Documentos: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/documents/page.tsx`
- Reportes: `/Users/johanrojas/Documents/CST-Manto/src/app/(tabs)/reports/page.tsx`

## Seguridad por rol
- `ADMIN`:
  - control total
  - crear camiones
  - corregir lecturas
  - ajustar odómetro de camión
  - revertir órdenes/mantenimientos
- `OPERATOR` / `MECHANIC`:
  - operar flujo diario (registro y ejecución)
  - sin privilegios administrativos
