import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import {
  CollisionCheckQuerySchema,
  CreateLicenseSchema,
  LicenseListQuerySchema,
  SetRenewedToSchema,
  SimilarLicensesQuerySchema,
  UpdateLicenseSchema,
  type CollisionCheckQuery,
  type CreateLicenseInput,
  type LicenseListQuery,
  type SetRenewedToInput,
  type SimilarLicensesQuery,
  type UpdateLicenseInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { LicensesService } from './licenses.service';

@Controller('licenses')
export class LicensesController {
  constructor(private readonly licenses: LicensesService) {}

  @Get()
  list(@Query(zodPipe(LicenseListQuerySchema)) query: LicenseListQuery) {
    return this.licenses.list(query);
  }

  /** Advisory exclusivity collision check, called live from the form. */
  @Get('collisions')
  collisions(
    @Query(zodPipe(CollisionCheckQuerySchema)) query: CollisionCheckQuery,
  ) {
    return this.licenses.checkCollisions(query);
  }

  /** "Similar Past Licenses" pricing reference for the form's side panel. */
  @Get('similar')
  similar(
    @Query(zodPipe(SimilarLicensesQuerySchema)) query: SimilarLicensesQuery,
  ) {
    return this.licenses.similar(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.licenses.detail(id);
  }

  /** Born-invoiced: creates the License and its Invoice atomically (ADR-0002). */
  @Post()
  create(
    @Body(zodPipe(CreateLicenseSchema)) body: CreateLicenseInput,
    @Session() session: UserSession,
  ) {
    return this.licenses.create(body, session.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateLicenseSchema)) body: UpdateLicenseInput,
  ) {
    return this.licenses.update(id, body);
  }

  /** Manual, forward-only Renewal pointer. */
  @Patch(':id/renewed-to')
  setRenewedTo(
    @Param('id') id: string,
    @Body(zodPipe(SetRenewedToSchema)) body: SetRenewedToInput,
  ) {
    return this.licenses.setRenewedTo(id, body.renewedToId);
  }
}
