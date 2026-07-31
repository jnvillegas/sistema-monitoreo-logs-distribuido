import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

// Infraestructura
import { WatcherService } from './infrastructure/wathcer-service';
import { HttpLogPublisherAdapter } from './infrastructure/http-log-publisher-adapter';

// Aplicación
import { LogProcessorService } from './usecase/log-processor-service';
import { LOG_PUBLISHER_TOKEN } from './interface/interface-log-publisher';

@Module({
    imports: [
        // HttpModule es necesario porque nuestro adaptador usa HttpService de Axios
        HttpModule, 
        // ConfigModule es necesario porque nuestros servicios usan ConfigService
        ConfigModule 
    ],
    providers: [
        // 1. Registramos los servicios normales
        WatcherService,
        LogProcessorService,
        
        // 2. El "truco" de Clean Architecture en NestJS:
        // Le decimos a Nest: "Cuando alguien pida el LOG_PUBLISHER_TOKEN, 
        // entrégale una instancia de HttpLogPublisherAdapter"
        {
            provide: LOG_PUBLISHER_TOKEN,
            useClass: HttpLogPublisherAdapter,
        }
    ],
    // Si quisieras usar el Watcher o Processor desde OTRO módulo, los exportarías aquí
    exports: [] 
})
export class LogsModule {}