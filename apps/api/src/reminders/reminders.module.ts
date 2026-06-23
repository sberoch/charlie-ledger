import { Module } from '@nestjs/common';
import { DrizzleModule } from '../common/database/drizzle.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [DrizzleModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
