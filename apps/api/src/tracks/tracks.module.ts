import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { TrackExportPdfService } from './track-export-pdf.service';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';

@Module({
  imports: [DrizzleModule],
  controllers: [TracksController],
  providers: [TracksService, TrackExportPdfService],
  exports: [TracksService],
})
export class TracksModule {}
