import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from "nestjs-pino";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false, bufferLogs: true });
    app.useLogger(app.get(Logger));
    await app.enableCors({ origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true });
  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
