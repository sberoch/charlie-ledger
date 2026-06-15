import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  TrackExportQuerySchema,
  TrackListQuerySchema,
  type TrackExportQuery,
  type TrackListQuery,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { TrackExportPdfService } from './track-export-pdf.service';
import { TracksService } from './tracks.service';

/** Human label for the active filter, shown on the PDF header. */
function filterLabel(query: TrackExportQuery): string {
  const parts: string[] = [query.tag ? `Tag · ${query.tag}` : 'All tags'];
  if (query.search) parts.push(`Search · "${query.search}"`);
  return parts.join('  ·  ');
}

/** Tag (or "all") slugged for the download filename: tracks_<tag-or-all>.<ext>. */
function filterSlug(query: TrackExportQuery): string {
  return query.tag
    ? query.tag
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
    : 'all';
}

// Read-only by design — the Track mirror is owned by Disco (CONTEXT.md).
@Controller('tracks')
export class TracksController {
  constructor(
    private readonly tracks: TracksService,
    private readonly exportPdf: TrackExportPdfService,
  ) {}

  @Get()
  list(@Query(zodPipe(TrackListQuerySchema)) query: TrackListQuery) {
    return this.tracks.list(query);
  }

  @Get('tags')
  tags() {
    return this.tracks.tags();
  }

  // Static export routes are declared before the `:id` param route so they
  // aren't swallowed by it (same ordering rule as `tags` above).
  @Get('export.csv')
  async exportCsv(
    @Query(zodPipe(TrackExportQuerySchema)) query: TrackExportQuery,
    @Res() res: Response,
  ) {
    const rows = await this.tracks.list(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tracks_${filterSlug(query)}.csv"`,
    );
    res.send(this.tracks.toCsv(rows, query.financials));
  }

  @Get('export.pdf')
  async exportPdfDoc(
    @Query(zodPipe(TrackExportQuerySchema)) query: TrackExportQuery,
    @Res() res: Response,
  ) {
    const rows = await this.tracks.list(query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tracks_${filterSlug(query)}.pdf"`,
    );
    this.exportPdf.render(rows, query.financials, filterLabel(query)).pipe(res);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.tracks.detail(id);
  }
}
