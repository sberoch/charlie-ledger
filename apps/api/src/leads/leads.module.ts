import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [DrizzleModule],
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
