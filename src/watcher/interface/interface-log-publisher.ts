import { MessageLogDto } from '../dto/message-log.dto';

export const LOG_PUBLISHER_TOKEN = Symbol('LOG_PUBLISHER');

export interface ILogPublisher {
  publishBatch(batch: MessageLogDto[], serviceName: string): Promise<void>;
}
