import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { LogsModule } from './watcher/logs.module';

@Module({
  imports: [ConfigModule.forRoot({isGlobal:true}) , LogsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
