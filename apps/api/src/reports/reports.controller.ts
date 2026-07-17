import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ReportQuerySchema, type ReportQuery } from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { ReportPdfService } from './report-pdf.service';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly pdf: ReportPdfService,
  ) {}

  @Get('sales')
  sales(@Query(zodPipe(ReportQuerySchema)) query: ReportQuery) {
    return this.reports.sales(query);
  }

  @Get('sales.csv')
  async salesCsv(
    @Query(zodPipe(ReportQuerySchema)) query: ReportQuery,
    @Res() res: Response,
  ) {
    const result = await this.reports.sales(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales_${query.from}_${query.to}_by_${query.groupBy}_${query.basis}.csv"`,
    );
    res.send(this.reports.toCsv(result));
  }

  @Get('sales.pdf')
  async salesPdf(
    @Query(zodPipe(ReportQuerySchema)) query: ReportQuery,
    @Res() res: Response,
  ) {
    const result = await this.reports.sales(query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales_${query.from}_${query.to}_by_${query.groupBy}_${query.basis}.pdf"`,
    );
    this.pdf.render(result).pipe(res);
  }
}
