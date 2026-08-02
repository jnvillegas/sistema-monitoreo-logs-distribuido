# ADR-0006: Envío de lotes por HTTP al servidor central

## Estado
Aceptado

## Contexto

El shipper debe entregar el contexto de errores a un servidor central. El transporte original dependía de Axios directo en la lógica de negocio; tras el refactor a Clean Architecture, el envío quedó aislado detrás del puerto `ILogPublisher`.

## Decisión

`HttpLogPublisherAdapter` implementa `ILogPublisher` y envía **el lote completo en una sola petición POST** a `CENTRAL_SERVER_URL` mediante `HttpService` (Axios). El lote es un array de `MessageLogDto` (`{ service, message, timestamp }`). La URL se lee de configuración y su ausencia lanza un error explícito.

## Consecuencias

Positivas:
- Un solo request por error detectado: reduce la cantidad de conexiones hacia el servidor central.
- Aislado detrás del puerto: se puede reemplazar por Kafka, cola, o archivo sin tocar la regla de negocio.
- Formato del payload simple y autocontenido (service, message, timestamp).

Negativas:
- **Sin reintentos ni backoff**: si el servidor central está caído o responde error, el lote se pierde y solo queda registrado en el logger del adaptador. Bug conocido, documentado en el README.
- Los errores se tragan (se loguean, no se propagan): el `LogProcessorService` no se entera de que el envío falló.
- Un solo punto de envío: lotes grandes generan payloads grandes en un único request.
