import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { TracksController } from './tracks.controller';
import { TracksService } from './tracks.service';

@Module({
  imports: [DrizzleModule],
  controllers: [TracksController],
  providers: [TracksService],
  exports: [TracksService],
})
export class TracksModule {}
