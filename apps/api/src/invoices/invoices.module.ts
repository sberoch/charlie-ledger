import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { InvoiceIssuerService } from './invoice-issuer.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [DrizzleModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoiceIssuerService, InvoicePdfService],
  exports: [InvoiceIssuerService, InvoicesService],
})
export class InvoicesModule {}
