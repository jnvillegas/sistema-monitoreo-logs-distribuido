# ADR-0005: Lectura incremental por offset de bytes

## Estado
Aceptado

## Contexto

Releer archivos de log completos en cada cambio sería ineficiente: los logs crecen constantemente. Se necesitaba leer solo la porción nueva de cada archivo, y además distinguir el crecimiento normal de una rotación (archivo vaciado/truncado).

## Decisión

`WatcherService` mantiene un `Map<string, number>` con la última posición de bytes leída por archivo. En cada evento:

- **`end > start`** (creció): se lee el rango `[start, end)` con `fs.createReadStream(filePath, { start, end: end - 1 })`.
- **`end < start`** (rotación/vaciado): se resetea el puntero a 0 y se relee lo que haya.

Al crear el archivo (`add`), se inicializa la posición con su tamaño actual para no releer contenido preexistente.

## Consecuencias

Positivas:
- Lee solo la porción nueva: costo proporcional a los bytes añadidos, no al archivo completo.
- Detecta y maneja rotación/truncado (archivos de log que se vacían o giran).

Negativas:
- El puntero se actualiza al final (`filePositions.set(filePath, end)`) sin esperar a que el stream termine de leer: un cambio concurrente durante la lectura puede perderse o leerse doble. Bug conocido, documentado en el README.
- La lógica asume que el archivo crece de forma secuencial; escrituras no lineales (append en medio) rompen el supuesto.
