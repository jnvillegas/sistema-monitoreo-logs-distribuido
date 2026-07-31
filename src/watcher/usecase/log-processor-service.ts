import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RingBuffer } from '../domain/ring-buffer';
import * as interfaceLogPublisher from '../interface/interface-log-publisher'; 
import { MessageLogDto } from '../dto/message-log.dto';

@Injectable()
export class LogProcessorService {
    private readonly logger = new Logger(LogProcessorService.name);
    
    // Diccionario de RingBuffers, uno por cada microservicio/archivo
    private buffers = new Map<string, RingBuffer<string>>();
    
    private readonly BUFFER_SIZE_KEY = 'LOG_BUFFER_SIZE';
    private readonly CRITERIA_KEY = 'LOG_CRITERIA';
    
    private readonly bufferSize: number;
    private readonly errorCriteria: RegExp;

    constructor(
        private readonly configService: ConfigService,
        @Inject(interfaceLogPublisher.LOG_PUBLISHER_TOKEN) private readonly logPublisher: interfaceLogPublisher.ILogPublisher
    ) {

        // 1. Convertimos explícitamente el texto del .env a un Número real
        const rawBufferSize = this.configService.get<string>('LOG_BUFFER_SIZE');
        this.bufferSize = rawBufferSize ? parseInt(rawBufferSize, 10) : 50;

        // 2. Convertimos explícitamente el texto del .env a un Objeto RegExp real
        const rawCriteria = this.configService.get<string>('LOG_CRITERIA');
        
        if (rawCriteria) {
            // Ojo: En tu archivo .env deberás poner solo el patrón, ej: ERROR|CRITICAL|FATAL
            this.errorCriteria = new RegExp(rawCriteria, 'i');
        } else {
            // El valor por defecto si no hay nada en el .env
            this.errorCriteria = /\[?(ERROR|CRITICAL|FATAL)\]?/i;
        }
    }

    /**
     * Procesa una nueva línea de log.
     * Esta función contiene la regla de negocio (Edge Filtering).
     */
    public async processLine(line: string, serviceName: string): Promise<void> {
        if (!line || line.trim() === '') return;

        const buffer = this.getOrCreateBuffer(serviceName);
        const isError = this.errorCriteria.test(line);

        if (isError) {
            this.logger.warn(`Error detectado en ${serviceName}. Vaciando contexto...`);
            
            // 1. Extraemos todo el contexto anterior
            const contextLines = buffer.flush();
            
            // 2. Unimos el contexto con la línea de error actual
            const batchToSend = [...contextLines, line];
            
            // 3. Transformamos a DTOs
            const dtos = batchToSend.map(msg => ({
                service: serviceName,
                message: msg,
                timestamp: new Date()
            }));

            // 4. Delegamos el envío al puerto de infraestructura
            await this.logPublisher.publishBatch(dtos, serviceName);

        } else {
            // Si no es error, simplemente lo guardamos en la memoria temporal
            buffer.add(line);
        }
    }

    private getOrCreateBuffer(serviceName: string): RingBuffer<string> {
        if (!this.buffers.has(serviceName)) {
            this.buffers.set(serviceName, new RingBuffer<string>(this.bufferSize));
        }
        return this.buffers.get(serviceName)!;
    }
}