import { Module } from '@nestjs/common';
import { AlbumsModule } from '../albums/albums.module';
import { DrizzleModule } from '../common/database/drizzle.module';
import { TrackExportPdfService } from './track-export-pdf.service';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';

@Module({
  imports: [DrizzleModule, AlbumsModule],
  controllers: [TracksController],
  providers: [TracksService, TrackExportPdfService],
  exports: [TracksService],
})
export class TracksModule {}
