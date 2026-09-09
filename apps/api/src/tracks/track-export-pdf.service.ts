import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  EXCLUSIVITY_TIER_LABELS,
  EXPIRATION_URGENCY_LABELS,
  USAGE_TYPE_LABELS,
  TERM_LENGTH_LABELS,
  expirationState,
  formatMoney,
  todayIso,
  type TrackLicenseHistoryItemDto,
  type TrackListItemDto,
} from '@workspace/shared';
import { COMPANY_NAME } from '../common/branding';

const INK = '#1a1a1a';
const MUTED = '#8d8a82';
const INK_SOFT = '#5c5952';
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
const ALBUM_COL: Column = {
  label: 'ALBUM',
  align: 'left',
  w: 0.2,
  cell: (r) => r.album ?? 'No album',
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
  { ...TRACK_COL, w: 0.34 },
  { ...ALBUM_COL, w: 0.22 },
  { ...TAGS_COL, w: 0.31 },
  { ...STATUS_COL, w: 0.13 },
];

const FINANCIAL_COLS: Column[] = [
  { ...TRACK_COL, w: 0.24 },
  { ...ALBUM_COL, w: 0.16 },
  { ...TAGS_COL, w: 0.2 },
  { ...STATUS_COL, w: 0.1 },
  {
    label: 'LIC',
    align: 'right',
    w: 0.07,
    cell: (r) => String(r.licenseCount),
  },
  {
    label: 'LIFETIME',
    align: 'right',
    w: 0.13,
    cell: (r) => formatMoney(r.lifetimeSales),
  },
  {
    label: 'LAST',
    align: 'right',
    w: 0.1,
    cell: (r) => (r.lastLicensedAt ? human(r.lastLicensedAt) : '—'),
  },
];

// ── License history timeline ────────────────────────────────────────────────
// A print take on the track page's timeline (apps/web/.../license-history.tsx):
// newest first, a year in the left gutter whenever it changes, a rail down the
// left with a dot per license — filled while the license is live, hollow once
// it has expired, the whole entry dimmed. Each license is three lines: the
// exact span, Brand (+ fee when financials are on), then the media granted,
// exclusivity, term, and urgency.

const TL_GAP = 6; // between the row cells and the first license
const TL_YEAR_W = 34; // left gutter that carries the year
const TL_RAIL_INSET = 6; // rail sits this far right of the year gutter
const TL_TEXT_INSET = 14; // text starts this far right of the rail
const TL_ITEM_PAD = 5; // vertical breathing room between licenses
const TL_SPAN_FONT = 6.5;
const TL_BRAND_FONT = 8;
const TL_META_FONT = 7;
const TL_LINE_GAP = 2;
const TL_DOT_R = 1.8;

class HistoryTimeline {
  private readonly today = todayIso();
  private readonly railX: number;
  private readonly textX: number;
  private readonly textW: number;

  constructor(
    private readonly doc: PDFKit.PDFDocument,
    contentWidth: number,
  ) {
    this.railX = MARGIN + TL_YEAR_W + TL_RAIL_INSET;
    this.textX = this.railX + TL_TEXT_INSET;
    this.textW = MARGIN + contentWidth - this.textX;
  }

  /** Height the given licenses would take, gap included. */
  blockHeight(licenses: TrackLicenseHistoryItemDto[]): number {
    return (
      TL_GAP +
      licenses.reduce((acc, l) => acc + this.itemHeight(l) + TL_ITEM_PAD, 0)
    );
  }

  /**
   * Draw the block starting at `y`; returns the y just past it. Breaks the
   * page between licenses when the next one would cross `bottom`, calling
   * `newPage` and re-reading the cursor through `cursor` afterwards.
   */
  draw(
    licenses: TrackLicenseHistoryItemDto[],
    y: number,
    bottom: number,
    newPage: () => void,
    cursor: () => number,
  ): number {
    y += TL_GAP;
    let railTop = y;
    let lastYear: string | null = null;
    // Dots go on after the rail so a hollow (expired) dot isn't struck through.
    let dots: { y: number; live: boolean }[] = [];
    const flushRail = (railBottom: number) => {
      this.doc
        .moveTo(this.railX, railTop)
        .lineTo(this.railX, railBottom)
        .lineWidth(0.6)
        .strokeColor(HAIRLINE)
        .stroke();
      for (const d of dots) {
        this.doc.circle(this.railX, d.y, TL_DOT_R).lineWidth(0.6);
        if (d.live) this.doc.fillAndStroke(INK, INK);
        else this.doc.fillAndStroke('#ffffff', MUTED);
      }
      dots = [];
    };

    for (const l of licenses) {
      const h = this.itemHeight(l);
      if (y + h > bottom) {
        flushRail(y);
        newPage();
        y = cursor();
        railTop = y;
        lastYear = null; // re-announce the year after a break
      }
      const year = l.startDate.slice(0, 4);
      if (year !== lastYear) {
        this.doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED);
        this.doc.text(year, MARGIN, y, { width: TL_YEAR_W, lineBreak: false });
        lastYear = year;
      }
      dots.push({ y: y + TL_SPAN_FONT / 2, live: this.drawItem(l, y) });
      y += h + TL_ITEM_PAD;
    }
    flushRail(y - TL_ITEM_PAD);
    return y;
  }

  private lines(l: TrackLicenseHistoryItemDto) {
    const span = `${human(l.startDate)} – ${
      l.endDate ? human(l.endDate) : 'Perpetual'
    }`.toUpperCase();
    const { urgency, daysLeft } = expirationState(l.endDate, this.today);
    const state =
      urgency === 'urgent' || urgency === 'expiring_soon'
        ? `${daysLeft}d left`
        : EXPIRATION_URGENCY_LABELS[urgency];
    const meta = [
      l.usageTypes.map((u) => USAGE_TYPE_LABELS[u]).join(' · '),
      `— ${EXCLUSIVITY_TIER_LABELS[l.exclusivityTier]}`,
      `· ${TERM_LENGTH_LABELS[l.termLength]}`,
      `· ${state}`,
    ].join(' ');
    return { span, meta, live: urgency !== 'expired' };
  }

  private itemHeight(l: TrackLicenseHistoryItemDto): number {
    const { span, meta } = this.lines(l);
    const doc = this.doc;
    doc.font('Courier').fontSize(TL_SPAN_FONT);
    const spanH = doc.heightOfString(span, { width: this.textW });
    doc.font('Courier-Bold').fontSize(TL_BRAND_FONT);
    const brandH = doc.heightOfString(l.brandName, {
      width: this.brandWidth(l),
    });
    doc.font('Courier').fontSize(TL_META_FONT);
    const metaH = doc.heightOfString(meta, { width: this.textW });
    return spanH + TL_LINE_GAP + brandH + TL_LINE_GAP + metaH;
  }

  /** Brand wraps short of the right-aligned fee when there is one. */
  private brandWidth(l: TrackLicenseHistoryItemDto): number {
    return l.fee === undefined ? this.textW : this.textW * 0.7;
  }

  /** Draws one license's three lines; returns whether it is live. */
  private drawItem(l: TrackLicenseHistoryItemDto, y: number): boolean {
    const { span, meta, live } = this.lines(l);
    const doc = this.doc;
    const ink = live ? INK : MUTED;

    doc.font('Courier').fontSize(TL_SPAN_FONT).fillColor(MUTED);
    doc.text(span, this.textX, y, { width: this.textW, characterSpacing: 1 });
    y = doc.y + TL_LINE_GAP;

    doc.font('Courier-Bold').fontSize(TL_BRAND_FONT).fillColor(ink);
    const brandTop = y;
    doc.text(l.brandName, this.textX, y, { width: this.brandWidth(l) });
    const afterBrand = doc.y;
    if (l.fee !== undefined) {
      doc.text(formatMoney(l.fee), this.textX, brandTop, {
        width: this.textW,
        align: 'right',
        lineBreak: false,
      });
    }
    y = afterBrand + TL_LINE_GAP;

    doc
      .font('Courier')
      .fontSize(TL_META_FONT)
      .fillColor(live ? INK_SOFT : MUTED);
    doc.text(meta, this.textX, y, { width: this.textW });
    return live;
  }
}

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

    const timeline = new HistoryTimeline(doc, width);

    doc.font('Helvetica-Bold').fontSize(18).fillColor(INK);
    doc.text(COMPANY_NAME.toUpperCase(), MARGIN, MARGIN);
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
    const bottom = doc.page.height - MARGIN - 60;
    const newPage = () => {
      doc.addPage();
      y = MARGIN;
    };
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

      // License history: a timeline block under the row (every license, no
      // cap), page-breaking between licenses when it runs long. Omitted for
      // tracks with no licenses. Keep the cells with at least the first
      // license so a track name never strands at a page bottom.
      const licenses = history ? (row.licenses ?? []) : [];
      const keepWith = licenses.length
        ? timeline.blockHeight(licenses.slice(0, 1))
        : 0;
      if (y + cellsHeight + keepWith + BOTTOM_PAD > bottom) newPage();

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
      y += cellsHeight;

      if (licenses.length) {
        y = timeline.draw(licenses, y, bottom, newPage, () => y);
      }

      y += BOTTOM_PAD;
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
