import { MessageLogDto } from "../dto/message-log.dto";

export const LOG_PUBLISHER_TOKEN = Symbol('LOG_PUBLISHER');

/**
 * Puerto de salida.
 * Independiente del protocolo.
 */
export interface ILogPublisher {
    publishBatch(batch: MessageLogDto[], serviceName: string): Promise<void>;
}