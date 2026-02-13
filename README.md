# CST Manto MVP (modo localStorage)

Aplicacion web mobile-first para control manual de mantenimiento de camiones con persistencia local en navegador.

## Stack actual
- Next.js + TypeScript
- TailwindCSS + Framer Motion
- Persistencia: `localStorage` (sin backend ni PostgreSQL en este modo)

## Funcionalidades MVP
- Registro de entrada de yarda con:
  - odometro manual (delta de millas)
  - hora de entrada a yarda
  - hora de salida de yarda
- Calculo automatico de horas trabajadas por entrada.
- Disparo automatico de mantenimientos por horas trabajadas:
  - Engrase cada 400 h
  - Cambio de aceite cada 800 h
- Soporte de mantenimiento multiple en una misma lectura.
- Prevencion de ordenes duplicadas abiertas por camion+tipo.
- Estado DUE / OVERDUE.
- Cierre de orden con historial de servicio y reset de contador.
- Correccion de odometro solo Admin con auditoria y recalculo.
- Reversion de cierre de orden solo Admin.
- Creacion de nuevos camiones solo Admin.
- Ajuste de odometro actual del camion solo Admin.
- Dashboard grafico con score de salud de flota (basado en horas).
- Pantalla de documentos por camión:
  - carga de PDF (aseguranza, placas o tipo libre)
  - fecha de inicio y fecha de expiración
  - calendario de próximos vencimientos
- Reportes semanales/mensuales/custom + export CSV.
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
3. Abrir:
   - [http://localhost:3000](http://localhost:3000)

## Sesion local actual
- Existe pantalla de login (`/login`) que funciona con autenticación local.
- La app opera en modo local sobre `localStorage`.
- Los usuarios seed se conservan en datos internos para roles/permisos:
  - Admin: `admin@cst-manto.local` / `Admin#2026`
  - Operador: `yard@cst-manto.local` / `Yard#2026`
  - Mecanico: `mech@cst-manto.local` / `Mech#2026`
- El login es opcional y los datos se almacenan localmente en el navegador.

## Notas
- Los datos viven en el navegador/dispositivo.
- Si limpias datos del sitio, se pierde la informacion almacenada.
