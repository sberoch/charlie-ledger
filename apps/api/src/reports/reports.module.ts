import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { ReportPdfService } from './report-pdf.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [DrizzleModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportPdfService],
})
export class ReportsModule {}
