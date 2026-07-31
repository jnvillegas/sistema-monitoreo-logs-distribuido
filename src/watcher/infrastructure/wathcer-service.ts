import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import { LogProcessorService } from '../usecase/log-processor-service';

@Injectable()
export class WatcherService {
    private readonly logger = new Logger(WatcherService.name);
    private filePositions = new Map<string, number>();
    private readonly LOG_DIR_KEY = 'LOG_DIRECTORY';

    constructor(
        private readonly configService: ConfigService,
        // Inyectamos el caso de uso. El Watcher ya no sabe qué es un Búfer ni Axios.
        private readonly logProcessor: LogProcessorService 
    ) {}

    onModuleInit() {
        const logDir = this.configService.get<string>(this.LOG_DIR_KEY);
        if (!logDir) throw new Error('log directory undefined!');

        this.logger.log(`[*] Iniciando vigilancia en : ${logDir}`);
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, {recursive : true});

        const watcher = chokidar.watch(logDir, { persistent: true, usePolling: true, interval: 200 });

        watcher.on('add', (filePath) => {
            const stats = fs.statSync(filePath);
            this.filePositions.set(filePath, stats.size);
            this.logger.debug(`[File detected] ${filePath}`);
        });

        watcher.on('change', (filePath) => this.handleFilechange(filePath));
    }


    private async handleFilechange(filePath: string) {
        const stats = fs.statSync(filePath);
        let start = this.filePositions.get(filePath) || 0;
        const end = stats.size;

        // Escenario 1: El archivo creció normalmente (Logs añadidos)
        if (end > start) {
            this.leerStream(filePath, start, end);
        } 
        // Escenario 2: El archivo se encogió (Fue vaciado, truncado o rotado)
        else if (end < start) {
            this.logger.warn(`[Rotación detectada] El archivo fue vaciado: ${filePath}`);
            // Reiniciamos el puntero al inicio
            start = 0; 
            
            if (end > 0) {
                this.leerStream(filePath, start, end);
            } else {
                // Si el archivo quedó totalmente en 0 bytes, solo actualizamos el puntero
                this.filePositions.set(filePath, 0);
            }
        }
    }

        // Extraje la lógica de lectura a una función privada para no repetir código
    private leerStream(filePath: string, start: number, end: number) {
        const stream = fs.createReadStream(filePath, { start, end: end - 1 });

        stream.on('data', async (chunk) => {
            // Aquí llamas a tu LogProcessorService de la arquitectura limpia
            await this.logProcessor.processLine(chunk.toString(), filePath);
        });

        this.filePositions.set(filePath, end);
    }

    private extractServiceName(filePath: string): string {
        const parts = filePath.replace(/\\/g, '/').split('/'); 
        return parts[parts.length - 1].split('.')[0];
    }
}