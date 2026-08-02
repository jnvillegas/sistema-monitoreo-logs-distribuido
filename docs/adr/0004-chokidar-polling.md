# ADR-0004: Polling para detección de cambios en archivos

## Estado
Aceptado

## Contexto

El shipper vigila un directorio de logs y debe reaccionar cuando los archivos cambian. Los eventos nativos del sistema operativo (inotify, FSEvents, ReadDirectoryChangesW) son rápidos y económicos, pero poco confiables en los entornos donde vive este sistema: logs generados dentro de contenedores Docker, volúmenes montados o filesystems de red (NFS/Samba) pierden o retrasan los eventos.

## Decisión

Usar `chokidar` con `usePolling: true` e `interval: 200` (200ms): el watcher pregunta al filesystem por el tamaño de los archivos en cada tick y dispara `change` cuando detecta una diferencia. Este modo funciona en cualquier filesystem, contenedor o red, a costa de CPU y latencia acotada.

## Consecuencias

Positivas:
- Funciona de forma consistente en Docker, volúmenes montados y sistemas de red.
- Máximo atraso predecible: 1 intervalo (200ms), imperceptible para monitoreo de logs.
- Implementación simple, sin dependencia de magia del kernel.

Negativas:
- Gasto de CPU proporcional a la cantidad de archivos vigilados × ticks por segundo. Aceptable con pocos archivos; problemático con miles.
- Cambios que ocurren y se revierten entre dos ticks no se detectan (el tamaño vuelve a ser el mismo).
- La latencia de 200ms es un tradeoff: menor intervalo = más CPU; mayor intervalo = más atraso.
