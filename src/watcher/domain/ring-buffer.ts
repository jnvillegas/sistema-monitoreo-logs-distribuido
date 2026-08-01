export class RingBuffer<T> {
  private buffer: T[] = [];

  constructor(private readonly maxSize: number) {
    if (maxSize <= 0) {
      throw new Error('El tamaño del buffer debe ser mayor a 0.');
    }
  }

  public add(item: T): void {
    this.buffer.push(item);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }

  public flush(): T[] {
    const batch = [...this.buffer];
    this.buffer = [];
    return batch;
  }

  public get length(): number {
    return this.buffer.length;
  }
}
