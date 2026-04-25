import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WatcherModule } from './watcher/watcher.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({isGlobal:true}) , WatcherModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
