import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import {
  InvoiceListQuerySchema,
  MarkPaidSchema,
  UpdateInvoiceDatesSchema,
  VoidAndReissueSchema,
  formatInvoiceNumber,
  type InvoiceListQuery,
  type MarkPaidInput,
  type UpdateInvoiceDatesInput,
  type VoidAndReissueInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicesService } from './invoices.service';

// No POST /invoices on purpose — invoices are born with their License/Demo
// (ADR-0002); the issuer is reachable only through those create transactions.
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly pdf: InvoicePdfService,
  ) {}

  @Get()
  list(@Query(zodPipe(InvoiceListQuerySchema)) query: InvoiceListQuery) {
    return this.invoices.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.invoices.detail(id);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const dto = await this.invoices.detail(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${formatInvoiceNumber(dto.number)}.pdf"`,
    );
    this.pdf.render(dto).pipe(res);
  }

  /** Dates only (ADR-0014) — the billing snapshot has no mutation surface. */
  @Patch(':id/dates')
  updateDates(
    @Param('id') id: string,
    @Body(zodPipe(UpdateInvoiceDatesSchema)) body: UpdateInvoiceDatesInput,
  ) {
    return this.invoices.updateDates(id, body);
  }

  @Post(':id/paid')
  markPaid(
    @Param('id') id: string,
    @Body(zodPipe(MarkPaidSchema)) body: MarkPaidInput,
  ) {
    return this.invoices.markPaid(id, body.paidDate);
  }

  @Delete(':id/paid')
  clearPaid(@Param('id') id: string) {
    return this.invoices.clearPaid(id);
  }

  /** Atomic void & reissue — no bare void exists (ADR-0002). */
  @Post(':id/void-and-reissue')
  voidAndReissue(
    @Param('id') id: string,
    @Body(zodPipe(VoidAndReissueSchema)) body: VoidAndReissueInput,
    @Session() session: UserSession,
  ) {
    return this.invoices.voidAndReissue(id, body, session.user.id);
  }
}
