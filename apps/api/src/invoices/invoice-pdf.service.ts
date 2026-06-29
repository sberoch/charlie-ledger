import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  formatInvoiceNumber,
  formatMoney,
  type InvoiceDto,
} from '@workspace/shared';
import { SENDER } from '../common/branding';

// Layout v1, derived from the prototype's ledger aesthetic: mono body
// (Courier), display header (Helvetica-Bold), hairline rules, square
// everything. Treated as a draft until the layout is locked with Charlie —
// content fields are final, composition may move.

const INK = '#1a1a1a';
const MUTED = '#8d8a82';
const HAIRLINE = '#d9d5cd';
const RUST = '#8b3a2a';
const MARGIN = 56;

function human(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

@Injectable()
export class InvoicePdfService {
  render(inv: InvoiceDto): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
    const width = doc.page.width - MARGIN * 2;
    const right = doc.page.width - MARGIN;

    // ── Header ──
    doc.font('Helvetica-Bold').fontSize(22).fillColor(INK);
    doc.text(SENDER.legalName.toUpperCase(), MARGIN, MARGIN);

    doc.font('Helvetica-Bold').fontSize(16).fillColor(INK);
    doc.text('INVOICE', MARGIN, MARGIN, { width, align: 'right' });
    doc.font('Courier-Bold').fontSize(12);
    doc.text(formatInvoiceNumber(inv.number), MARGIN, doc.y + 2, {
      width,
      align: 'right',
    });

    // ── Rule ──
    doc
      .moveTo(MARGIN, 140)
      .lineTo(right, 140)
      .lineWidth(1.5)
      .strokeColor(INK)
      .stroke();

    // ── Sender / Bill-to / Dates ──
    const blockTop = 158;
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text('FROM', MARGIN, blockTop, { characterSpacing: 1.5 });
    doc.font('Courier').fontSize(9).fillColor(INK);
    SENDER.contact.forEach((line, i) =>
      i === 0 ? doc.text(line, MARGIN, blockTop + 14) : doc.text(line),
    );

    const billToX = MARGIN + width * 0.38;
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text('BILL TO', billToX, blockTop, { characterSpacing: 1.5 });
    doc.font('Courier-Bold').fontSize(10).fillColor(INK);
    doc.text(inv.billToName, billToX, blockTop + 14, { width: width * 0.34 });
    doc.font('Courier').fontSize(9);
    if (inv.billToAddress) doc.text(inv.billToAddress, { width: width * 0.34 });
    if (inv.billToEmail) doc.text(inv.billToEmail, { width: width * 0.34 });

    const datesX = MARGIN + width * 0.76;
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text('ISSUED', datesX, blockTop, { characterSpacing: 1.5 });
    doc.font('Courier').fontSize(9).fillColor(INK);
    doc.text(human(inv.issueDate), datesX, blockTop + 14);
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text('DUE', datesX, doc.y + 8, { characterSpacing: 1.5 });
    doc.font('Courier').fontSize(9).fillColor(INK);
    doc.text(human(inv.dueDate), datesX, doc.y + 2);

    // ── Line item table: TYPE · DESCRIPTION · AMOUNT ──
    const tableTop = 290;
    const descX = MARGIN + width * 0.2;
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text('TYPE', MARGIN, tableTop, { characterSpacing: 1.5 });
    doc.text('DESCRIPTION', descX, tableTop, { characterSpacing: 1.5 });
    doc.text('AMOUNT', MARGIN, tableTop, {
      width,
      align: 'right',
      characterSpacing: 1.5,
    });
    doc
      .moveTo(MARGIN, tableTop + 16)
      .lineTo(right, tableTop + 16)
      .lineWidth(0.8)
      .strokeColor(INK)
      .stroke();

    const rowTop = tableTop + 28;
    const typeLabel = inv.source.kind === 'license' ? 'License' : 'Demo';
    doc.font('Courier').fontSize(10).fillColor(INK);
    doc.text(typeLabel, MARGIN, rowTop, { width: width * 0.18 });
    // Description carries the snapshotted grant terms — may run several lines.
    doc.text(inv.description, descX, rowTop, { width: width * 0.52 });
    const descBottom = doc.y;
    doc.font('Courier-Bold').fontSize(10);
    doc.text(formatMoney(inv.amount), MARGIN, rowTop, {
      width,
      align: 'right',
    });
    const rowBottom = Math.max(descBottom + 14, tableTop + 56);
    doc
      .moveTo(MARGIN, rowBottom)
      .lineTo(right, rowBottom)
      .lineWidth(0.5)
      .strokeColor(HAIRLINE)
      .stroke();

    // ── Total ──
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text('TOTAL DUE', MARGIN, rowBottom + 18, {
      width,
      align: 'right',
      characterSpacing: 1.5,
    });
    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK);
    doc.text(formatMoney(inv.amount), MARGIN, doc.y + 4, {
      width,
      align: 'right',
    });

    // ── Footer ──
    const footY = doc.page.height - MARGIN - 40;
    doc
      .moveTo(MARGIN, footY)
      .lineTo(right, footY)
      .lineWidth(0.5)
      .strokeColor(HAIRLINE)
      .stroke();
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text(
      'Payment due within 30 days of issue. Thank you.',
      MARGIN,
      footY + 12,
      { width, align: 'center', characterSpacing: 1 },
    );

    // ── VOID stamp ──
    if (inv.status === 'voided') {
      doc.save();
      doc.rotate(-22, { origin: [doc.page.width / 2, doc.page.height / 2] });
      doc.font('Helvetica-Bold').fontSize(96).fillColor(RUST).fillOpacity(0.18);
      doc.text('VOID', 0, doc.page.height / 2 - 60, {
        width: doc.page.width,
        align: 'center',
      });
      doc.restore();
    }

    doc.end();
    return doc;
  }
}
