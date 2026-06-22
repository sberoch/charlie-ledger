import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  formatLicenseSpan,
  formatMoney,
  type TrackListItemDto,
} from '@workspace/shared';

const INK = '#1a1a1a';
const MUTED = '#8d8a82';
const HAIRLINE = '#d9d5cd';
const MARGIN = 56;
// Smaller than the 10pt report body so more tag lists fit on a single line.
const ROW_FONT = 8;
// Right inset on every column so text never butts against the next column.
const GUTTER = 10;

function human(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Column {
  label: string;
  align: 'left' | 'right';
  /** Fraction of the content width. */
  w: number;
  cell: (r: TrackListItemDto) => string;
}

const TRACK_COL: Column = {
  label: 'TRACK',
  align: 'left',
  w: 0.3,
  cell: (r) => r.name,
};
const TAGS_COL: Column = {
  label: 'TAGS',
  align: 'left',
  w: 0.32,
  // Up to 5 tags in the PDF (full list lives in the CSV); ellipsis past that.
  cell: (r) => r.tags.slice(0, 5).join(', ') + (r.tags.length > 5 ? ' …' : ''),
};
const STATUS_COL: Column = {
  label: 'STATUS',
  align: 'left',
  w: 0.14,
  cell: (r) => (r.status === 'archived' ? 'Archived' : 'Active'),
};

const CATALOG_COLS: Column[] = [
  { ...TRACK_COL, w: 0.45 },
  { ...TAGS_COL, w: 0.4 },
  { ...STATUS_COL, w: 0.15 },
];

const FINANCIAL_COLS: Column[] = [
  TRACK_COL,
  { ...TAGS_COL, w: 0.26 },
  { ...STATUS_COL, w: 0.12 },
  {
    label: 'LIC',
    align: 'right',
    w: 0.08,
    cell: (r) => String(r.licenseCount),
  },
  {
    label: 'LIFETIME',
    align: 'right',
    w: 0.14,
    cell: (r) => formatMoney(r.lifetimeSales),
  },
  {
    label: 'LAST',
    align: 'right',
    w: 0.1,
    cell: (r) => (r.lastLicensedAt ? human(r.lastLicensedAt) : '—'),
  },
];

/** Same ledger voice as the invoice/report PDFs — mono table, hairlines, square. */
@Injectable()
export class TrackExportPdfService {
  render(
    rows: TrackListItemDto[],
    financials: boolean,
    history: boolean,
    filterLabel: string,
  ): PDFKit.PDFDocument {
    const doc = new PDFDocument({ size: 'LETTER', margin: MARGIN });
    const width = doc.page.width - MARGIN * 2;
    const right = doc.page.width - MARGIN;
    const cols = financials ? FINANCIAL_COLS : CATALOG_COLS;

    // License history is a full-width caption under each track row (never a
    // column) so it has room to flow uncapped; indented so it reads as detail.
    const HIST_INDENT = 12;
    const HIST_X = MARGIN + HIST_INDENT;
    const HIST_W = width - HIST_INDENT;
    const HIST_GAP = 5; // between the row cells and the caption
    const HIST_LABEL_H = 11;

    doc.font('Helvetica-Bold').fontSize(18).fillColor(INK);
    doc.text('CHARLIE FOLTZ MEDIA LLC', MARGIN, MARGIN);
    doc.font('Courier').fontSize(9).fillColor(MUTED);
    doc.text(
      `TRACK EXPORT · ${financials ? 'WITH FINANCIALS' : 'CATALOG'}${
        history ? ' · LICENSE HISTORY' : ''
      }`,
      MARGIN,
      doc.y + 4,
      { characterSpacing: 1.5 },
    );
    doc.text(filterLabel.toUpperCase(), MARGIN, doc.y + 2, {
      characterSpacing: 1,
    });

    doc
      .moveTo(MARGIN, 130)
      .lineTo(right, 130)
      .lineWidth(1.2)
      .strokeColor(INK)
      .stroke();

    // Column header row.
    let y = 148;
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    let x = MARGIN;
    for (const col of cols) {
      const w = width * col.w;
      doc.text(col.label, x, y, {
        width: w - GUTTER,
        align: col.align,
        characterSpacing: 1.5,
      });
      x += w;
    }
    y += 18;

    if (rows.length === 0) {
      doc.font('Courier').fontSize(10).fillColor(MUTED);
      doc.text('No tracks match.', MARGIN, y, { width, align: 'left' });
      y += 22;
    }

    const TOP_PAD = 6;
    const BOTTOM_PAD = 10;
    for (const row of rows) {
      // Cells wrap freely; the row grows to fit its tallest cell (usually the
      // tags), so a long tag list never bleeds into the next row.
      const cells = cols.map((col) => {
        const w = width * col.w;
        const money = col.label === 'LIFETIME';
        doc
          .font(money ? 'Courier-Bold' : 'Courier')
          .fontSize(ROW_FONT)
          .fillColor(INK);
        const text = col.cell(row);
        const h = doc.heightOfString(text, {
          width: w - GUTTER,
          align: col.align,
        });
        return { col, w, money, text, h };
      });
      const cellsHeight = TOP_PAD + Math.max(...cells.map((c) => c.h));

      // License history caption: every license, inline-flowed (no cap), under
      // the row. Omitted for tracks with no licenses.
      const licenses = history ? (row.licenses ?? []) : [];
      const historyText = licenses.map(formatLicenseSpan).join('   ·   ');
      let historyHeight = 0;
      if (licenses.length) {
        doc.font('Courier').fontSize(ROW_FONT);
        historyHeight =
          HIST_GAP +
          HIST_LABEL_H +
          doc.heightOfString(historyText, { width: HIST_W });
      }

      const rowHeight = cellsHeight + historyHeight + BOTTOM_PAD;

      if (y + rowHeight > doc.page.height - MARGIN - 60) {
        doc.addPage();
        y = MARGIN;
      }

      x = MARGIN;
      for (const cell of cells) {
        doc
          .font(cell.money ? 'Courier-Bold' : 'Courier')
          .fontSize(ROW_FONT)
          .fillColor(INK);
        doc.text(cell.text, x, y + TOP_PAD, {
          width: cell.w - GUTTER,
          align: cell.col.align,
        });
        x += cell.w;
      }

      if (licenses.length) {
        let yy = y + cellsHeight + HIST_GAP;
        doc.font('Courier').fontSize(7).fillColor(MUTED);
        doc.text('LICENSED BY', HIST_X, yy, { characterSpacing: 1.5 });
        yy += HIST_LABEL_H;
        doc.font('Courier').fontSize(ROW_FONT).fillColor(INK);
        doc.text(historyText, HIST_X, yy, { width: HIST_W });
      }

      y += rowHeight;
      doc
        .moveTo(MARGIN, y - BOTTOM_PAD / 2)
        .lineTo(right, y - BOTTOM_PAD / 2)
        .lineWidth(0.4)
        .strokeColor(HAIRLINE)
        .stroke();
    }

    // Footer: track count, plus Σ lifetime sales when financials are included.
    y += 10;
    doc.font('Courier').fontSize(8).fillColor(MUTED);
    doc.text(`${rows.length} TRACKS`, MARGIN, y + 6, { characterSpacing: 1.5 });
    if (financials) {
      const total = rows
        .reduce((acc, r) => acc + Number(r.lifetimeSales), 0)
        .toFixed(2);
      doc.font('Helvetica-Bold').fontSize(16).fillColor(INK);
      doc.text(formatMoney(total), MARGIN, y, { width, align: 'right' });
    }

    doc.end();
    return doc;
  }
}
