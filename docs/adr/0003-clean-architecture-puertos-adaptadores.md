# ADR-0003: Arquitectura limpia con puertos y adaptadores

## Estado
Aceptado

## Contexto

El shipper interactúa con infraestructura externa: filesystem (chokidar, fs), configuración y red (Axios/HTTP). Si la regla de negocio dependiera directamente de esas tecnologías, un cambio de transporte (HTTP → Kafka → archivo) o de mecanismo de detección obligaría a reescribir la lógica de negocio. Se buscaba separar lo que es regla de negocio de lo que es tecnología.

## Decisión

Estructurar el módulo `src/watcher/` en cuatro capas con dependencias apuntando hacia adentro:

| Capa | Rol | Contenido |
|------|-----|-----------|
| `domain/` | Lógica pura, sin framework | `ring-buffer.ts` |
| `usecase/` | Regla de negocio (edge filtering) | `log-processor-service.ts` |
| `interface/` | Contratos (puertos) | `ILogPublisher`, `LOG_PUBLISHER_TOKEN` |
| `infrastructure/` | Adaptadores externos | `wathcer-service.ts`, `http-log-publisher-adapter.ts` |

El patrón clave: `LogProcessorService` inyecta el contrato `ILogPublisher` (vía `LOG_PUBLISHER_TOKEN`), nunca la implementación concreta. El binding se resuelve en `logs.module.ts` (`useClass: HttpLogPublisherAdapter`).

## Consecuencias

Positivas:
- Cambiar de transporte HTTP a otro medio solo requiere un adaptador nuevo + una línea en el módulo.
- La regla de negocio es testeable con un mock del puerto, sin tocar red ni filesystem.
- El lector del código entiende de un vistazo qué es regla de negocio y qué es infraestructura.

Negativas:
- Más archivos y más indirección que una solución acoplada; costo de entrada mayor para quienes no conocen el patrón.
- Requiere disciplina para no "filtrar" detalles de infraestructura hacia el usecase (hoy se respeta en el procesamiento, aunque el watcher aún pasa el path completo como nombre de servicio — ver README, Limitaciones conocidas).
