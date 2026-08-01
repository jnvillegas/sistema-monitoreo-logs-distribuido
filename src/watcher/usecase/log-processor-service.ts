import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RingBuffer } from '../domain/ring-buffer';
import * as interfaceLogPublisher from '../interface/interface-log-publisher';

@Injectable()
export class LogProcessorService {
  private readonly logger = new Logger(LogProcessorService.name);

  private buffers = new Map<string, RingBuffer<string>>();

  private readonly BUFFER_SIZE_KEY = 'LOG_BUFFER_SIZE';
  private readonly CRITERIA_KEY = 'LOG_CRITERIA';

  private readonly bufferSize: number;
  private readonly errorCriteria: RegExp;

  constructor(
    private readonly configService: ConfigService,
    @Inject(interfaceLogPublisher.LOG_PUBLISHER_TOKEN)
    private readonly logPublisher: interfaceLogPublisher.ILogPublisher,
  ) {
    const rawBufferSize = this.configService.get<string>('LOG_BUFFER_SIZE');
    this.bufferSize = rawBufferSize ? parseInt(rawBufferSize, 10) : 50;

    const rawCriteria = this.configService.get<string>('LOG_CRITERIA');

    if (rawCriteria) {
      this.errorCriteria = new RegExp(rawCriteria, 'i');
    } else {
      this.errorCriteria = /\[?(ERROR|CRITICAL|FATAL)\]?/i;
    }
  }

  public async processLine(line: string, serviceName: string): Promise<void> {
    if (!line || line.trim() === '') return;

    const buffer = this.getOrCreateBuffer(serviceName);
    const isError = this.errorCriteria.test(line);

    if (isError) {
      this.logger.warn(
        `Error detectado en ${serviceName}. Vaciando contexto...`,
      );

      const contextLines = buffer.flush();

      const batchToSend = [...contextLines, line];

      const dtos = batchToSend.map((msg) => ({
        service: serviceName,
        message: msg,
        timestamp: new Date(),
      }));

      await this.logPublisher.publishBatch(dtos, serviceName);
    } else {
      buffer.add(line);
    }
  }

  private getOrCreateBuffer(serviceName: string): RingBuffer<string> {
    if (!this.buffers.has(serviceName)) {
      this.buffers.set(serviceName, new RingBuffer<string>(this.bufferSize));
    }
    return this.buffers.get(serviceName);
  }
}
