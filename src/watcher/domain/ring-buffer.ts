export class RingBuffer<T> {

    private buffer: T[] = [];

    constructor(private readonly maxSize: number) {
        if (maxSize <= 0) {
            throw new Error("El tamaño del buffer debe ser mayor a 0.");
        }
    }

    /**
     * Agrega un nuevo elemento.
     * Si se supera el limite, elimina el mas antiguo.
     * @param item 
     */

    public add(item: T): void {

        this.buffer.push(item);

        if (this.buffer.length > this.maxSize) {
            this.buffer.shift();
        }

    }

    /**
     * Retorna todos los elementos actuales
     * y limpia la memoria.
     * @returns 
     */
    public flush(): T[] {
        const batch = [...this.buffer];
        this.buffer = [];
        return batch;
    }

    public get length(): number {
        return this.buffer.length;
    }


}