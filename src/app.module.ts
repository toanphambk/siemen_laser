import { Module } from '@nestjs/common';
import { MainControllerModule } from './main-controller/main-controller.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, load: [() => configuration] }),
    MainControllerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
