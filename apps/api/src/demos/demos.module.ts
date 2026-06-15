import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { DemosController } from './demos.controller';
import { DemosService } from './demos.service';

@Module({
  imports: [DrizzleModule, InvoicesModule],
  controllers: [DemosController],
  providers: [DemosService],
  exports: [DemosService],
})
export class DemosModule {}
