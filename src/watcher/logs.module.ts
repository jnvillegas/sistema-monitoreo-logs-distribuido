import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import { WatcherService } from './infrastructure/wathcer-service';
import { HttpLogPublisherAdapter } from './infrastructure/http-log-publisher-adapter';

import { LogProcessorService } from './usecase/log-processor-service';
import { LOG_PUBLISHER_TOKEN } from './interface/interface-log-publisher';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [
    WatcherService,
    LogProcessorService,

    {
      provide: LOG_PUBLISHER_TOKEN,
      useClass: HttpLogPublisherAdapter,
    },
  ],
  exports: [],
})
export class LogsModule {}
