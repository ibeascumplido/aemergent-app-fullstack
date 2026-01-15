# Dashboard Web - Presupuestos y Calendario

## Descripción del Proyecto
Dashboard web con dos módulos principales: gestión de presupuestos tipo Excel y calendario de vacaciones para operarios.

## Arquitectura
- **Backend**: FastAPI + Motor (MongoDB async)
- **Frontend**: React + TailwindCSS + Shadcn/UI
- **Base de datos**: MongoDB

## Módulos Implementados

### 1. Módulo de Presupuestos ✅
- Plantilla tipo Excel para crear presupuestos
- Cálculos automáticos: precios, márgenes, IVA
- Columnas auxiliares ocultas en PDF (coste, margen)
- Cálculo detallado de mano de obra
- Resumen de ganancias
- Vista previa e impresión de PDF
- Persistencia completa en base de datos
- **Logo INICIA** en esquina superior izquierda (actualizado 15/01/2026)
- **Colores corporativos rojos** en encabezados (actualizado 15/01/2026)
- **Columna NOMBRE ampliada** para más caracteres (actualizado 15/01/2026)
- **Fuentes optimizadas para PDF** (actualizado 15/01/2026)

### 2. Módulo de Calendario ✅ (COMPLETADO 15/01/2026)
- Vista mensual con 12 slots por día
- Gestión de operarios con colores
- **Vacaciones**: Disponibles, Disfrutados, Restantes
- **Días Libres**: Disponibles, Disfrutados, Restantes
- Marcado visual diferenciado (días libres con borde negro)
- Inputs editables para ambos tipos de días
- Formulario de operario con ambos campos

### 3. Dashboard Principal ✅
- Estadísticas de presupuestos
- Total aprobados (sin IVA)
- Navegación entre módulos

## Archivos Clave
- `/app/backend/server.py` - API FastAPI completa
- `/app/frontend/src/pages/BudgetTemplatePage.jsx` - Presupuestos
- `/app/frontend/src/pages/CalendarPage.jsx` - Calendario
- `/app/frontend/src/pages/HomePage.jsx` - Dashboard

## API Endpoints
- `GET/POST /api/budget-templates` - Presupuestos
- `GET/POST /api/operarios` - Operarios
- `GET/POST /api/vacaciones` - Vacaciones/Días libres
- `GET /api/vacaciones/resumen` - Resumen con contadores
- `GET /api/dashboard/stats` - Estadísticas

## Estado Actual
✅ MVP Completo
✅ Todas las funcionalidades solicitadas implementadas
✅ Estética corporativa INICIA implementada

## Backlog / Mejoras Futuras
- P2: Refactorizar BudgetTemplatePage.jsx (>1100 líneas)
- P3: Añadir autenticación de usuarios completa
