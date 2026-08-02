# ADR-0001: Edge filtering (filtrado en el borde)

## Estado
Aceptado

## Contexto

En un sistema distribuido, cada microservicio genera logs continuamente. Enviar todo al servidor central tiene tres problemas: satura el tráfico de red, llena el almacenamiento con ruido, y diluye la señal (un error aislado sin contexto es difícil de diagnosticar). Se necesitaba una estrategia que redujera el volumen y entregara errores útiles.

## Decisión

Filtrar **en el borde** (donde se genera el log), no centralizar todo. El shipper acumula líneas normales en memoria y solo envía algo al servidor central cuando detecta una línea que coincide con un criterio de error configurable (`LOG_CRITERIA`, por defecto `ERROR|CRITICAL|FATAL`). Cuando aparece el error, se envía **el error + las líneas previas** como lote.

## Consecuencias

Positivas:
- Tráfico hacia el servidor central reducido drásticamente (solo se envían errores con contexto).
- Los errores llegan con el contexto necesario para diagnosticar, no como líneas huérfanas.
- El criterio de error es configurable por entorno (`LOG_CRITERIA`).

Negativas:
- El contexto vive solo en memoria: si el proceso muere antes de un error, se pierde.
- La ventana de contexto está limitada al tamaño del buffer (`LOG_BUFFER_SIZE`).
- Depende de que el criterio de error (`RegExp`) coincida con el formato real de los logs: un cambio de formato puede dejar errores sin detectar.
