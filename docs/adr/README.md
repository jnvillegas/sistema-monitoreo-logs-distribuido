# Architecture Decision Records

Registro de decisiones de arquitectura del sistema de monitoreo de logs distribuido.

Cada ADR documenta una decisión tomada: el contexto que la motivó, la decisión concreta, y sus consecuencias (positivas y negativas).

| ADR | Decisión | Estado |
|-----|----------|--------|
| [0001](0001-edge-filtering.md) | Edge filtering: filtrar en el borde, no centralizar todo | Aceptado |
| [0002](0002-ring-buffer-contexto.md) | Ring buffer como almacenamiento de contexto en memoria | Aceptado |
| [0003](0003-clean-architecture-puertos-adaptadores.md) | Arquitectura limpia con puertos y adaptadores | Aceptado |
| [0004](0004-chokidar-polling.md) | Polling para detección de cambios en archivos | Aceptado |
| [0005](0005-lectura-incremental-bytes.md) | Lectura incremental por offset de bytes | Aceptado |
| [0006](0006-envio-lotes-http.md) | Envío de lotes por HTTP al servidor central | Aceptado |

## Convención

Formato basado en Michael Nygard. Cada ADR es inmutable una vez aceptado: si la decisión cambia, se crea un ADR nuevo que supera al anterior.
