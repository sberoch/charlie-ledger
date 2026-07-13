import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { RoyaltiesController } from './royalties.controller';
import { RoyaltiesService } from './royalties.service';

@Module({
  imports: [DrizzleModule],
  controllers: [RoyaltiesController],
  providers: [RoyaltiesService],
})
export class RoyaltiesModule {}
