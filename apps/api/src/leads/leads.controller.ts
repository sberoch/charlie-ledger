import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  CreateLeadSchema,
  UpdateLeadSchema,
  type CreateLeadInput,
  type UpdateLeadInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { LeadsService } from './leads.service';

// Personal ledger (ADR-0005) — a plain CRUD surface, deliberately unlike the
// born-invoiced License/Demo flows. Free create / edit / hard delete.
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list() {
    return this.leads.list();
  }

  @Post()
  create(
    @Body(zodPipe(CreateLeadSchema)) body: CreateLeadInput,
    @Session() session: UserSession,
  ) {
    return this.leads.create(body, session.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateLeadSchema)) body: UpdateLeadInput,
  ) {
    return this.leads.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leads.remove(id);
  }
}
