import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
    // Cross-origin fetch can't read the download filename otherwise — the web
    // client falls back to the URL's last segment ("pdf") → "pdf.pdf".
    exposedHeaders: ['Content-Disposition'],
  });
  await app.listen(process.env.PORT ?? 5000);
}
void bootstrap();
