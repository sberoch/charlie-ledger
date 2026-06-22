import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [DrizzleModule],
  controllers: [TagsController],
  providers: [TagsService],
  exports: [TagsService],
})
export class TagsModule {}
