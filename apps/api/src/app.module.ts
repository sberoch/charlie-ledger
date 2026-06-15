import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { auth } from './auth/auth';
import { DashboardModule } from './dashboard/dashboard.module';
import { DemosModule } from './demos/demos.module';
import { DigestModule } from './digest/digest.module';
import { DrizzleModule } from './common/database/drizzle.module';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';
import { LicensesModule } from './licenses/licenses.module';
import { loggerOptions } from './common/logger/logger.config';
import { PartiesModule } from './parties/parties.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { TracksModule } from './tracks/tracks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    LoggerModule.forRoot(loggerOptions),
    AuthModule.forRoot({ auth, bodyParser: { json: { limit: '2mb' } } }),
    ScheduleModule.forRoot(),
    DrizzleModule,
    UsersModule,
    HealthModule,
    PartiesModule,
    InvoicesModule,
    LicensesModule,
    DemosModule,
    TracksModule,
    DashboardModule,
    ReportsModule,
    DigestModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
