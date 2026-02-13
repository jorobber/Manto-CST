# CST Manto MVP (modo localStorage)

Aplicacion web mobile-first para control manual de mantenimiento de camiones con persistencia local en navegador.

## Stack actual
- Next.js 14 + TypeScript
- TailwindCSS + Framer Motion
- Persistencia: `localStorage` (sin backend ni PostgreSQL en este modo)

## Funcionalidades MVP
- Registro de entrada de yarda con odometro manual.
- Calculo de delta automatico.
- Disparo automatico de mantenimientos por intervalo.
- Soporte de mantenimiento multiple en una misma lectura.
- Prevencion de ordenes duplicadas abiertas por camion+tipo.
- Estado DUE / OVERDUE.
- Cierre de orden con historial de servicio y reset de contador.
- Correccion de odometro solo Admin con auditoria y recalculo.
- Dashboard + reportes semanales/mensuales/custom + export CSV.
- Export PDF via ventana de impresion del navegador.

## Inicio rapido
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Levantar app:
   ```bash
   npm run dev
   ```

## Datos seed locales
- Admin: `admin@cst-manto.local`
- Operador: `yard@cst-manto.local`
- Tipos: Engrase (400), Cambio de aceite (800)
- Camiones demo: TRK-001, TRK-002

## Notas
- Los datos viven en el navegador/dispositivo.
- Boton `Reset local` reinicia dataset semilla.
- Si limpias datos del sitio, se pierde la informacion almacenada.
