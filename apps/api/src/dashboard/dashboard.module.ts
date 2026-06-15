import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [DrizzleModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  // Exported for the weekly digest, which reuses the same look-ahead queries.
  exports: [DashboardService],
})
export class DashboardModule {}
