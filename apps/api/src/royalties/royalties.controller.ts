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
  CreateRoyaltyPaymentSchema,
  UpdateRoyaltyPaymentSchema,
  type CreateRoyaltyPaymentInput,
  type UpdateRoyaltyPaymentInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { RoyaltiesService } from './royalties.service';

// Royalty payments (ADR-0009) — received income, deliberately NOT the invoice
// rails: plain CRUD, free create / edit / hard delete, like Leads.
@Controller('royalties')
export class RoyaltiesController {
  constructor(private readonly royalties: RoyaltiesService) {}

  @Get()
  list() {
    return this.royalties.list();
  }

  @Post()
  create(
    @Body(zodPipe(CreateRoyaltyPaymentSchema)) body: CreateRoyaltyPaymentInput,
    @Session() session: UserSession,
  ) {
    return this.royalties.create(body, session.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateRoyaltyPaymentSchema)) body: UpdateRoyaltyPaymentInput,
  ) {
    return this.royalties.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.royalties.remove(id);
  }
}
