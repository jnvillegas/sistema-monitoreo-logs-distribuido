# Sistema de Monitoreo de Logs Distribuido

Shipper de logs construido con NestJS que vigila un directorio de archivos de log, aplica **edge filtering** (filtra en el borde) y envía al servidor central solo los errores **con su contexto previo**. Pensado para entornos de microservicios donde cada nodo genera logs propios y se necesita visibilidad centralizada sin inundar al servidor.

---

## Quick path

```bash
# 1. Instalar dependencias
npm install

# 2. Crear .env con las variables mínimas (ver .env.example)
cp .env.example .env

# 3. Crear el directorio que se va a vigilar (debe coincidir con LOG_DIRECTORY)
mkdir logs

# 4. Levantar en modo desarrollo
npm run start:dev
```

El servicio arranca en `http://localhost:3000` (o el puerto de `PORT`) y comienza a vigilar `LOG_DIRECTORY`. Para verlo funcionar: escribí una línea con la palabra `ERROR` dentro de cualquier archivo `.log` del directorio vigilado — debería disparar un POST al `CENTRAL_SERVER_URL`.

---

## Cómo funciona

```
[Archivo .log en disco]
        │  chokidar detecta cambio (polling cada 200ms)
        ▼
WatcherService ── lee solo los bytes nuevos (start → end) ──▶ LogProcessorService
                                                                    │
                                          ¿coincide con LOG_CRITERIA?
                                                    │
                              ┌─────────────────────┴─────────────────────┐
                              ▼ NO                                        ▼ SÍ
                    RingBuffer.add(line)                 RingBuffer.flush() + línea de error
                    (guarda contexto en memoria)              │
                                                            ▼
                                          HttpLogPublisherAdapter
                                          (POST del lote al servidor central)
```

La idea clave es **edge filtering**: las líneas normales solo viven en un `RingBuffer` en memoria ( contexto temporal, tamaño configurable). Cuando aparece un error, se "vacía" el contexto y se envía **error + líneas previas** en un solo lote. Esto reduce drásticamente el tráfico hacia el servidor central y entrega los errores con el contexto necesario para diagnosticarlos.

---

## Arquitectura (Clean Architecture)

El módulo `src/watcher/` sigue Clean Architecture: las dependencias apuntan hacia adentro. La regla de negocio no conoce Axios, fs ni chokidar.

| Capa | Responsabilidad | Archivo |
|------|------------------|---------|
| `domain/` | Lógica pura, sin framework | `ring-buffer.ts` |
| `usecase/` | Regla de negocio (edge filtering) | `log-processor-service.ts` |
| `interface/` | Contratos (puertos) | `interface-log-publisher.ts` |
| `infrastructure/` | Adaptadores externos (fs, HTTP) | `wathcer-service.ts`, `http-log-publisher-adapter.ts` |

**Patrón clave**: `LogProcessorService` inyecta `ILogPublisher` (el contrato), no `HttpLogPublisherAdapter` (la implementación). El binding se hace en `logs.module.ts` vía `LOG_PUBLISHER_TOKEN`. Cambiar el transporte (HTTP → Kafka → archivo local) solo requiere un nuevo adaptador y una línea en el módulo.

---

## Configuración

Todas las variables se leen con `@nestjs/config`. Copiá `.env.example` a `.env` y ajustá los valores.

| Variable | Requerida | Default | Descripción |
|----------|:--------:|---------|-------------|
| `LOG_DIRECTORY` | Sí | — | Directorio a vigilar (se crea si no existe) |
| `CENTRAL_SERVER_URL` | Sí | — | URL del servidor central que recibe los lotes |
| `PORT` | No | `3000` | Puerto del proceso NestJS |
| `LOG_BUFFER_SIZE` | No | `50` | Tamaño del `RingBuffer` (líneas de contexto por servicio) |
| `LOG_CRITERIA` | No | `ERROR\|CRITICAL\|FATAL` | Patrón regex para detectar errores (sin las barras) |

> `LOG_CRITERIA` se compila como `new RegExp(valor, 'i')`. Ejemplo: `LOG_CRITERIA=ERROR|PANIC|OOM`.

---

## Estructura del proyecto

```
src/
├── main.ts                         # Bootstrap de NestJS + lectura de PORT
├── app.module.ts                   # Módulo raíz: ConfigModule + LogsModule
├── app.controller.ts / .service.ts  # Endpoint de salud (Hello World)
└── watcher/
    ├── logs.module.ts              # Binding LOG_PUBLISHER_TOKEN → HttpLogPublisherAdapter
    ├── domain/
    │   └── ring-buffer.ts          # Buffer circular (memoria de contexto)
    ├── usecase/
    │   └── log-processor-service.ts# Edge filtering + delegación al publisher
    ├── interface/
    │   └── interface-log-publisher.ts # Puerto ILogPublisher (contrato)
    ├── infrastructure/
    │   ├── wathcer-service.ts      # chokidar + lectura incremental por bytes
    │   └── http-log-publisher-adapter.ts # Adaptador HTTP (Axios)
    └── dto/
        └── message-log.dto.ts      # DTO del lote enviado al servidor central
```

---

## Scripts

| Script | Qué hace |
|--------|-----------|
| `npm run start:dev` | Modo watch (recompila en cada cambio) |
| `npm run start` | Arranque normal |
| `npm run start:prod` | Producción (usa `dist/main.js`) |
| `npm run build` | Compila a `dist/` |
| `npm test` | Tests unitarios (Jest) |
| `npm run test:e2e` | Tests end-to-end |
| `npm run test:cov` | Cobertura de tests |
| `npm run lint` | ESLint con fix |
| `npm run format` | Prettier |

Requisitos: **Node >= 20**, **npm >= 10** (ver `engines` en `package.json`).

---

## Formato del lote enviado

Cada lote es un `POST` a `CENTRAL_SERVER_URL` con un array de `MessageLogDto`:

```json
[
  { "service": "pagos-svc", "message": "...línea de contexto...", "timestamp": "2026-08-01T12:00:00.000Z" },
  { "service": "pagos-svc", "message": "...línea de error...",   "timestamp": "2026-08-01T12:00:00.100Z" }
]
```

---

## Limitaciones conocidas

Honestidad técnica: este shipper está en estado funcional pero con puntos débiles a corregir antes de producción.

- **Lectura por chunks, no por líneas** (`wathcer-service.ts:73`): un chunk de `createReadStream` puede cortar una línea a la mitad. El detector de errores y el contexto pueden fallar si la palabra `ERROR` queda partida entre dos chunks.
- **`extractServiceName` definido pero no usado** (`wathcer-service.ts:79`): se pasa el path completo como `serviceName`, por lo que el `Map` de `RingBuffer` arma una entrada distinta por cada archivo y el contexto no se aísla por microservicio.
- **Puntero adelantado sin esperar el stream** (`wathcer-service.ts:76`): se actualiza `filePosition` antes de que termine la lectura. Cambios concurrentes pueden perderse o leerse doble.
- **Sin retry ni backoff** en el envío HTTP (`http-log-publisher-adapter.ts:33`): si el servidor central está caído, el lote se pierde y solo queda en logs.
- **Sin tests del módulo `watcher`**: el único test existente es el spec "Hello World" del starter NestJS.

---

## Próximos pasos

1. Corregir la lectura por líneas (bug crítico #1).
2. Conectar `extractServiceName` para aislar el contexto por microservicio.
3. Agregar retry/backoff al `HttpLogPublisherAdapter`.
4. Cubrir el módulo `watcher` con tests unitarios.
5. Documentar las decisiones de arquitectura como ADRs.