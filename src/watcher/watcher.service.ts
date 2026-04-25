import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { log } from 'console';

@Injectable()
export class WatcherService {

    private readonly logger = new Logger(WatcherService.name);
    private filePositions = new Map<String, number>();
    private readonly LOG_DIR_KEY = 'LOG_DIRECTORY';
    private readonly SERVER_URL_KEY = 'CENTRAL_SERVER_URL';

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
        const serviceName = path.basename(filePath, '.log');
        const serverUrl = this.configService.get<string>(this.SERVER_URL_KEY);

        if (!serverUrl) {
            throw new Error('log directory undefined!');
        }

        for (const line of lines) {
            
            try {

                const json = {
                    service: serviceName,
                    message: line,
                    timestamp: new Date().toISOString()
                };

                await firstValueFrom(this.httpService.post(serverUrl, json));
                this.logger.debug(`[Sent] ${serviceName} -> log line processed.`);

            } catch (error) {
                this.logger.error(`Error enviando log, ${error}`);
            }
        }

    }

}
