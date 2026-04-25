import { Module } from '@nestjs/common';
import { WatcherService } from './watcher.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [WatcherService]
})
export class WatcherModule {}
