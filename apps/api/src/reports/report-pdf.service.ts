import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  REPORT_GROUP_BY_LABELS,
  formatMoney,
  type ReportResultDto,
} from '@workspace/shared';
import { COMPANY_NAME } from '../common/branding';

const INK = '#1a1a1a';
const MUTED = '#8d8a82';
const HAIRLINE = '#d9d5cd';
const MARGIN = 56;

function human(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Same ledger voice as the invoice PDF — mono table, hairlines, square. */
@Injectable()
export class ReportPdfService {
  render(result: ReportResultDto): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
    const width = doc.page.width - MARGIN * 2;
    const right = doc.page.width - MARGIN;

    doc.font('Helvetica-Bold').fontSize(18).fillColor(INK);
    doc.text(COMPANY_NAME.toUpperCase(), MARGIN, MARGIN);
    doc.font('Courier').fontSize(9).fillColor(MUTED);
    doc.text(
      `SALES REPORT · BY ${REPORT_GROUP_BY_LABELS[result.groupBy].toUpperCase()}`,
      MARGIN,
      doc.y + 4,
      { characterSpacing: 1.5 },
    );
    doc.text(`${human(result.from)} — ${human(result.to)}`, MARGIN, doc.y + 2, {
      characterSpacing: 1,
    });

    doc
      .moveTo(MARGIN, 130)
      .lineTo(right, 130)
      .lineWidth(1.2)
      .strokeColor(INK)
      .stroke();

    let y = 148;
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text(REPORT_GROUP_BY_LABELS[result.groupBy].toUpperCase(), MARGIN, y, {
      characterSpacing: 1.5,
    });
    doc.text('INVOICES', MARGIN + width * 0.55, y, {
      width: width * 0.15,
      align: 'right',
      characterSpacing: 1.5,
    });
    doc.text('TOTAL', MARGIN, y, {
      width,
      align: 'right',
      characterSpacing: 1.5,
    });
    y += 18;

    for (const row of result.rows) {
      if (y > doc.page.height - MARGIN - 80) {
        doc.addPage();
        y = MARGIN;
      }
      doc.font('Courier').fontSize(10).fillColor(INK);
      doc.text(row.label, MARGIN, y, { width: width * 0.5, ellipsis: true });
      doc.text(String(row.invoiceCount), MARGIN + width * 0.55, y, {
        width: width * 0.15,
        align: 'right',
      });
      doc.font('Courier-Bold');
      doc.text(formatMoney(row.total), MARGIN, y, { width, align: 'right' });
      y += 22;
      doc
        .moveTo(MARGIN, y - 6)
        .lineTo(right, y - 6)
        .lineWidth(0.4)
        .strokeColor(HAIRLINE)
        .stroke();
    }

    y += 10;
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text(`${result.paidInvoiceCount} PAID INVOICES`, MARGIN, y + 6, {
      characterSpacing: 1.5,
    });
    doc.font('Helvetica-Bold').fontSize(16).fillColor(INK);
    doc.text(formatMoney(result.grandTotal), MARGIN, y, {
      width,
      align: 'right',
    });

    if (result.includeLeads) {
      doc.font('Courier').fontSize(7).fillColor(MUTED);
      doc.text(
        `INCLUDES ${formatMoney(result.leadTotal)} FROM PERSONAL-LEDGER LEADS · MAY DOUBLE-COUNT INVOICED FEES`,
        MARGIN,
        y + 28,
        { characterSpacing: 1 },
      );
    }

    doc.end();
    return doc;
  }
}
