import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';

@Module({
  imports: [DrizzleModule],
  controllers: [DigestController],
  providers: [DigestService],
})
export class DigestModule {}
