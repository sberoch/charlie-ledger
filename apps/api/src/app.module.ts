import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth/auth";
import { DrizzleModule } from "./common/database/drizzle.module";
import { UsersModule } from "./users/users.module";
import { LoggerModule } from "nestjs-pino";
import { loggerOptions } from "./common/logger/logger.config";
import { HealthModule } from "./health/health.module";

@Module({
  imports: [LoggerModule.forRoot(loggerOptions), AuthModule.forRoot({ auth, bodyParser: { json: { limit: "2mb" } } }), DrizzleModule, UsersModule, HealthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
