import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { buffer, firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { log } from 'console';
import { MessageLogDto } from './dto/message-log.dto';

@Injectable()
export class WatcherService {

    private filePositions = new Map<String, number>();
    private logBuffers = new Map<string, string[]>();

    private readonly logger = new Logger(WatcherService.name);
    private readonly LOG_DIR_KEY = 'LOG_DIRECTORY';
    private readonly SERVER_URL_KEY = 'CENTRAL_SERVER_URL';
    private readonly BUFFER_SIZE_KEY = 'LOG_BUFFER_SIZE';
    private readonly CRITERIA_KEY = 'LOG_CRITERIA';


    constructor(private readonly httpService: HttpService, private readonly configService: ConfigService) {}

    onModuleInit() {

        const logDir = this.configService.get<string>(this.LOG_DIR_KEY);

        if (!logDir) {
            throw new Error('log directory undefined!');
        }

        this.logger.log(`[*] Iniciando vigilancia en : ${logDir}`);

        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, {recursive : true});
        }

        const chokidarProperties = {
            persistent: true,
            usePolling: true,
            interval: 200
        };

        const watcher = chokidar.watch(logDir, chokidarProperties);

        watcher.on('add', (filePath) => {
            
            const stats = fs.statSync(filePath);
            this.filePositions.set(filePath, stats.size);
            this.logger.debug(`[File detected] ${filePath}`);

            }
        );

        watcher.on('change', (filePath) => this.handleFilechange(filePath));
    }

    private async handleFilechange(filePath: string) {
        
        const stats = fs.statSync(filePath);
        const start = this.filePositions.get(filePath) || 0;
        const end = stats.size;

        if (end > start) {

            const stream = fs.createReadStream(filePath, { start, end: end - 1});

            stream.on('data', async (chunk) => {
                await this.processLines(chunk.toString(), filePath);
            });

            this.filePositions.set(filePath, end);
        }
        
    }

    private async processLines(content: string, filePath: string) {
        
        const lines = content.split('\n').filter(line => line.trim() != '');
        const serviceName = this.extractServiceName(filePath);
        const criteria = this.configService.get<RegExp>(this.CRITERIA_KEY, /\[?(ERROR|CRITICAL|FATAL)\]?/i);
        const bufferSize = this.configService.get<number>(this.BUFFER_SIZE_KEY, 0);
        
        

        if (!this.logBuffers.has(filePath)) {
            this.logBuffers.set(filePath, []);
        }

        const buffer = this.logBuffers.get(filePath)!;

        for (const line of lines) {

            const isError = criteria.test(line);
            buffer?.push(line);

            if (buffer.length >= bufferSize && !isError) {
                buffer.shift();
            }

            if (isError) {
                this.logger.warn('error detected');
                const batchToSend = [...buffer];
                buffer.length = 0;
                await this.sendBatchToCentralServer(batchToSend, serviceName);

            }
        }

    }


    async sendBatchToCentralServer(batchToSend: string[], serviceName: string) {

        const url = this.configService.get<string>(this.SERVER_URL_KEY);

        if (!url) {
            throw new Error('Central server url undefined!');
        }

        try {
            
            const payloadBatch: MessageLogDto[] = batchToSend.map(line => ({

                service: serviceName,
                message: line,
                timestamp: new Date()

            }));

            await this.httpService.axiosRef.post(url, payloadBatch);

            this.logger.log(`[*] Lote de ${payloadBatch.length} logs enviado exitosamente a Central.`);


        } catch (error) {

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;

            this.logger.error(` : ${errorMessage}`, errorStack);
            
        }
    }

    private extractServiceName(filePath: string): string {
        const parts = filePath.replace(/\\/g, '/').split('/'); 
        const fileName = parts[parts.length - 1];
        return fileName.split('.')[0];
    }

}
