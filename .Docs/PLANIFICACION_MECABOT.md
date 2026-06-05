# INFORME DETALLADO - PROYECTO JUAN MECANICO AI

## 1. Identificacion del proyecto

- Nombre: `Juan Mecánico AI`
- Tipo: Chatbot asesor de repuestos y piezas automotoras (enfoque motos)
- Contexto: complemento del sistema de inventario/POS del otro grupo
- Estado: implementado en version MVP funcional

## 2. Contexto y justificacion

El grupo aliado ya cubre operaciones core del negocio: inventario, ventas POS, reportes y usuarios.  
Juan Mecánico AI se plantea como una capa de asistencia conversacional para resolver dudas técnicas frecuentes de clientes y personal sobre:

- funcion de piezas
- sintomas de falla
- mantenimiento preventivo
- criterios de compra y compatibilidad general

Esto reduce dependencia de asesoria manual para consultas repetitivas y mejora la experiencia de atencion.

## 3. Problema identificado

En tiendas de repuestos de motos, gran parte de las preguntas de usuario son repetitivas y tecnicas.  
Sin una herramienta de soporte:

- se retrasa la atencion
- se cometen errores de orientacion basica
- aumenta la carga operativa sobre vendedores

## 4. Objetivo general

Disenar e implementar un chatbot asesor especializado en repuestos automotores, capaz de responder consultas frecuentes en lenguaje natural con estrategia hibrida:

1. base de conocimiento local
2. Gemini como proveedor principal de IA
3. OpenRouter como respaldo

## 5. Objetivos especificos

1. Construir una interfaz de chat simple tipo asesor flotante.
2. Implementar backend de orquestacion con validacion y control de errores.
3. Priorizar respuestas locales para reducir consumo de IA.
4. Integrar Gemini `gemini-2.5-flash`.
5. Integrar OpenRouter como fallback.
6. Incorporar reglas de seguridad para evitar diagnosticos definitivos.
7. Mantener separacion clara respecto al sistema POS del otro grupo.

## 6. Alcance funcional

### 6.1 Funciones incluidas

- consulta sobre piezas (bujia, bateria, frenos, llantas, cadena, filtros, etc.)
- orientacion por sintomas (no enciende, perdida de potencia, sobrecalentamiento, vibracion)
- recomendaciones de mantenimiento basico
- guia de compatibilidad general (solicitando datos faltantes)
- continuidad conversacional basica en modo local
- fallback local cuando IA no responde

### 6.2 Funciones excluidas

- confirmacion de compatibilidad exacta sin datos tecnicos
- diagnostico mecanico definitivo
- operaciones del sistema POS (ventas, inventario, usuarios, reportes)
- promesas de stock o precio en tiempo real

## 7. Arquitectura de la solucion

```txt
Usuario (web)
   |
   v
Frontend React + TypeScript (widget flotante)
   |
   v
Backend Node.js + Express
   |
   +--> Motor local (knowledgeBase.json + scoring + contexto)
   |
   +--> Gemini API (principal)
   |
   +--> OpenRouter API (respaldo)
```

## 8. Flujo de procesamiento de mensaje

1. Frontend envia `message` + `history` a `POST /api/chat`.
2. Backend valida payload con Zod.
3. Motor local intenta resolver:
   - match por keywords
   - scoring por tokens
   - continuidad con contexto del ultimo mensaje usuario
4. Si local responde, se retorna `source: local`.
5. Si local no alcanza umbral, se consulta Gemini.
6. Si Gemini falla, se consulta OpenRouter.
7. Si OpenRouter falla, se retorna fallback local de seguridad.

## 9. Stack tecnologico implementado

### 9.1 Frontend

- React
- TypeScript
- Vite
- CSS custom
- Lucide React (iconos)
- localStorage para persistir el historial de conversacion

### 9.2 Backend

- Node.js
- Express
- TypeScript
- Zod
- dotenv

### 9.3 Proveedores IA

- Gemini API (`gemini-2.5-flash`)
- OpenRouter (`openrouter/free`) como respaldo

## 10. Estructura real del proyecto

```txt
Chat-Proyecto-integrador/
  .Docs/
    PLANIFICACION_MECABOT.md
    FUENTES_BASE_LOCAL_MECABOT.md
    formato idea de software primer corte-2.xlsx
  backend/
    .env
    .env.example
    src/
      config/env.ts
      data/knowledgeBase.json
      routes/chat.routes.ts
      services/
        chat.service.ts
        gemini.service.ts
        localKnowledge.service.ts
        openrouter.service.ts
        prompt.ts
        types.ts
      index.ts
  frontend/
    src/
      App.tsx
      App.css
      index.css
      services/chatApi.ts
      types.ts
```

## 11. Endpoints implementados

### 11.1 Health

- Metodo: `GET`
- Ruta: `/api/health`
- Uso: validar disponibilidad del backend

### 11.2 Chat

- Metodo: `POST`
- Ruta: `/api/chat`
- Request:

```json
{
  "message": "Mi moto no enciende, que puede ser?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

- Response:

```json
{
  "reply": "Texto de respuesta",
  "source": "local"
}
```

`source` puede ser: `local`, `gemini`, `openrouter`.

## 12. Base de conocimiento local

La base local fue ampliada para cubrir categorias clave:

- encendido y bujias
- bateria y sistema de carga
- lubricacion y aceite
- frenos (balatas, liquido, sintomas)
- llantas (presion, desgaste, seguridad)
- cadena y transmision
- filtros
- inyeccion vs carburador
- sintomas generales (vibracion, sobrecalentamiento, consumo alto)
- compatibilidad y criterios de compra

Ventaja tecnica:

- menor costo por uso de IA
- respuesta rapida en consultas frecuentes
- continuidad funcional aun con caida de proveedores externos

## 13. Reglas de seguridad del asistente

1. No dar diagnostico definitivo.
2. No asegurar compatibilidad exacta sin marca/modelo/cilindraje/anio.
3. Recomendar revision profesional ante riesgo de seguridad.
4. No inventar precio ni disponibilidad.
5. Mantener tono orientativo y claro.

## 14. Validaciones y control de errores

Validaciones principales del backend:

- `message` requerido, no vacio
- longitud maxima de `message`
- `history` acotado y estructurado

Errores esperados:

- `400`: payload invalido
- fallback local cuando fallan Gemini/OpenRouter

## 15. Estado de interfaz

Se implemento modo widget:

- boton circular flotante en esquina inferior derecha
- ventana compacta de chat al abrir
- boton de cierre
- loading con icono animado
- render de texto con negritas (`**texto**`)

## 16. Variables de entorno requeridas

Archivo: `backend/.env`

```env
PORT=3000
APP_NAME=Juan Mecánico AI
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
GEMINI_FALLBACK_MODEL=gemini-2.5-flash-lite
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openrouter/free
REQUEST_TIMEOUT_MS=12000
CORS_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173
```

## 17. Pruebas funcionales realizadas

1. `GET /api/health` responde `status: ok`.
2. `POST /api/chat` con consulta frecuente devuelve `source: local`.
3. Consulta tecnica no local devuelve `source: gemini` cuando hay conectividad.
4. Ante falla de Gemini, se usa OpenRouter (`source: openrouter`).
5. Ante falla total de IA, responde fallback local controlado.
6. Build de frontend y backend sin errores de compilacion.

## 18. Riesgos identificados y mitigacion

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| Saturacion o error de proveedor IA | Alto | Fallback escalonado local -> Gemini -> OpenRouter |
| Consumo excesivo de tokens | Medio | Prioridad de respuesta local |
| Error 400 por payload | Medio | Validacion frontend + backend + control de historial |
| Respuesta no confiable de IA | Alto | Prompt restrictivo + base local curada |
| Exposicion de API keys | Alto | Keys solo en backend `.env` |

## 19. Requisitos funcionales (RF)

- RF01: enviar preguntas en lenguaje natural
- RF02: recibir respuesta contextual
- RF03: priorizar base local
- RF04: escalar a Gemini cuando local no cubre
- RF05: usar OpenRouter como respaldo
- RF06: mostrar estado de carga
- RF07: mantener historial local de conversacion
- RF08: interfaz responsive tipo asesor flotante

## 20. Requisitos no funcionales (RNF)

- RNF01: seguridad de credenciales
- RNF02: tolerancia a falla parcial de servicios IA
- RNF03: tiempos de respuesta adecuados en consultas locales
- RNF04: mantenibilidad por separacion modular (frontend/backend/services/data)
- RNF05: usabilidad en escritorio y movil

## 21. Metricas sugeridas para evaluacion

1. Porcentaje de respuestas resueltas localmente.
2. Tiempo promedio de respuesta local vs IA.
3. Tasa de fallback por error de proveedor.
4. Tasa de consultas exitosas por sesion.
5. Satisfaccion de usuario (encuesta corta post-prueba).

## 22. Plan de mejora (siguiente iteracion)

1. Mostrar en UI la fuente de cada respuesta (`local/gemini/openrouter`).
2. Agregar panel admin para editar base local sin tocar JSON.
3. Implementar logging de errores con codigos de proveedor.
4. Agregar pruebas automatizadas de endpoints.
5. Incorporar versionado de base de conocimiento.

## 23. Conclusiones

Juan Mecánico AI cumple el objetivo de actuar como asesor conversacional especializado sin duplicar el sistema POS del otro grupo.  
La estrategia hibrida implementada reduce costos, mejora disponibilidad y permite continuidad operativa incluso cuando hay fallas de conectividad o cuota en proveedores de IA.

La base local enriquecida convierte a la IA en recurso de segundo nivel, que era el objetivo principal de esta etapa.

## 24. Bibliografia tecnica

Referencias documentadas en:

- `.Docs/FUENTES_BASE_LOCAL_MECABOT.md`

Incluye fuentes de NGK, Michelin, Brembo, Castrol, Yuasa y NHTSA usadas para curar contenido local.
