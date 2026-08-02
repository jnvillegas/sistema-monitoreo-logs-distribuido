# ADR-0002: Ring buffer como almacenamiento de contexto en memoria

## Estado
Aceptado

## Contexto

El edge filtering necesita acumular líneas normales como contexto temporal, con límite de memoria. Un array sin límite crecería indefinidamente en servicios con mucho tráfico. Se necesitaba una estructura con tamaño fijo que descartara lo más antiguo automáticamente.

## Decisión

Usar un `RingBuffer<T>` propio (`src/watcher/domain/ring-buffer.ts`) con un tamaño fijo configurable (`LOG_BUFFER_SIZE`, por defecto 50). Cada microservicio/archivo tiene su propio buffer, mantenido en un `Map<string, RingBuffer<string>>` dentro de `LogProcessorService`. `add()` inserta y descarta el más antiguo si se supera el límite; `flush()` devuelve todo el contenido y vacía el buffer.

## Consecuencias

Positivas:
- Uso de memoria acotado y predecible (O(tamaño máximo) por servicio).
- Independiente de frameworks: vive en la capa `domain`, testeable de forma aislada.
- `flush()` entrega el contexto y limpia en una sola operación, perfecto para el disparador de error.

Negativas:
- Implementación actual usa `Array.prototype.shift()`, que es O(n): el costo de inserción crece con el tamaño del buffer. Aceptable para tamaños pequeños (50), pero no escala a miles de líneas.
- El contexto más antiguo se pierde silenciosamente cuando el buffer se llena sin que aparezca un error.
