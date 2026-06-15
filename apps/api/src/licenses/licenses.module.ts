import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { LicensesController } from './licenses.controller';
import { LicensesService } from './licenses.service';

@Module({
  imports: [DrizzleModule, InvoicesModule],
  controllers: [LicensesController],
  providers: [LicensesService],
  exports: [LicensesService],
})
export class LicensesModule {}
