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
import type { Response } from 'express';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  CreateTrackSchema,
  ImportTracksSchema,
  TrackExportQuerySchema,
  TrackListQuerySchema,
  UpdateTrackSchema,
  UpdateTrackStatusSchema,
  type CreateTrackInput,
  type ImportTracksInput,
  type TrackExportQuery,
  type TrackListQuery,
  type UpdateTrackInput,
  type UpdateTrackStatusInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { TrackExportPdfService } from './track-export-pdf.service';
import { TracksService } from './tracks.service';

/** Human label for the active filter, shown on the PDF header. */
function filterLabel(query: TrackExportQuery): string {
  const parts: string[] = [query.tag ? `Tag · ${query.tag}` : 'All tags'];
  if (query.status)
    parts.push(query.status === 'archived' ? 'Archived' : 'Active');
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

// Catalog CRUD plus the read models and exports. Mutations mirror the licenses
// controller (zodPipe bodies, session-attributed). See CONTEXT.md / ADR-0006.
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
    const rows = await this.resolveRows(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tracks_${filterSlug(query)}.csv"`,
    );
    res.send(this.tracks.toCsv(rows, query.financials, query.history));
  }

  @Get('export.pdf')
  async exportPdfDoc(
    @Query(zodPipe(TrackExportQuerySchema)) query: TrackExportQuery,
    @Res() res: Response,
  ) {
    const rows = await this.resolveRows(query);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tracks_${filterSlug(query)}.pdf"`,
    );
    this.exportPdf
      .render(rows, query.financials, query.history, filterLabel(query))
      .pipe(res);
  }

  /** List rows for an export, enriched with license history when opted in. */
  private async resolveRows(query: TrackExportQuery) {
    const rows = await this.tracks.list(query);
    return query.history ? this.tracks.withLicenseHistory(rows) : rows;
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.tracks.detail(id);
  }

  @Post()
  create(
    @Body(zodPipe(CreateTrackSchema)) body: CreateTrackInput,
    @Session() session: UserSession,
  ) {
    return this.tracks.create(body, session.user.id);
  }

  // Bulk import from a Disco CSV export — best-effort, dedupes against the
  // case-insensitive natural key and within the batch. Distinct POST path, so
  // no collision with the `:id` route. See CONTEXT.md "Track import".
  @Post('import')
  importTracks(@Body(zodPipe(ImportTracksSchema)) body: ImportTracksInput) {
    return this.tracks.importTracks(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateTrackSchema)) body: UpdateTrackInput,
    @Session() session: UserSession,
  ) {
    return this.tracks.update(id, body, session.user.id);
  }

  // Named action — the only door to `status` (archive / unarchive), modeled on
  // PATCH /licenses/:id/renewed-to rather than overloading the update body.
  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body(zodPipe(UpdateTrackStatusSchema)) body: UpdateTrackStatusInput,
  ) {
    return this.tracks.setStatus(id, body.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tracks.remove(id);
  }
}
