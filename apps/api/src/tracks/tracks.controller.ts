import { Controller, Get, Param, Query } from '@nestjs/common';
import { TrackListQuerySchema, type TrackListQuery } from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { TracksService } from './tracks.service';

// Read-only by design — the Track mirror is owned by Disco (CONTEXT.md).
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracks: TracksService) {}

  @Get()
  list(@Query(zodPipe(TrackListQuerySchema)) query: TrackListQuery) {
    return this.tracks.list(query);
  }

  @Get('tags')
  tags() {
    return this.tracks.tags();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.tracks.detail(id);
  }
}
