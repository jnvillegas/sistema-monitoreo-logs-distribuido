import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ILogPublisher } from '../interface/interface-log-publisher';
import { MessageLogDto } from '../dto/message-log.dto';

@Injectable()
export class HttpLogPublisherAdapter implements ILogPublisher {
    private readonly logger = new Logger(HttpLogPublisherAdapter.name);
    private readonly SERVER_URL_KEY = 'CENTRAL_SERVER_URL';

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService
    ) {}

    async publishBatch(batch: MessageLogDto[], serviceName: string): Promise<void> {
        const url = this.configService.get<string>(this.SERVER_URL_KEY);

        if (!url) {
            throw new Error('Central server url undefined!');
        }

        try {
            // Enviamos el arreglo completo en UNA SOLA petición HTTP
            await this.httpService.axiosRef.post(url, batch);
            this.logger.log(`[*] Lote de ${batch.length} logs enviado para el servicio: ${serviceName}`);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Error enviando lote: ${errorMessage}`);
        }
    }
}