import { Controller, Param, Post } from '@nestjs/common';
import { RemindersService } from './reminders.service';

// The only user action on a Reminder in this cut: mark it done (ADR-0007).
@Controller('reminders')
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Post(':id/done')
  done(@Param('id') id: string) {
    return this.reminders.markDone(id);
  }
}
