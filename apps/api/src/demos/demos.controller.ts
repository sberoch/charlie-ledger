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
  ConvertDemoSchema,
  CreateDemoSchema,
  DemoListQuerySchema,
  LinkConvertedTrackSchema,
  UpdateDemoSchema,
  type ConvertDemoInput,
  type CreateDemoInput,
  type DemoListQuery,
  type LinkConvertedTrackInput,
  type UpdateDemoInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { DemosService } from './demos.service';

@Controller('demos')
export class DemosController {
  constructor(private readonly demos: DemosService) {}

  @Get()
  list(@Query(zodPipe(DemoListQuerySchema)) query: DemoListQuery) {
    return this.demos.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.demos.detail(id);
  }

  /** Born-invoiced: creates the Demo and its Invoice atomically (ADR-0002). */
  @Post()
  create(
    @Body(zodPipe(CreateDemoSchema)) body: CreateDemoInput,
    @Session() session: UserSession,
  ) {
    return this.demos.create(body, session.user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(zodPipe(UpdateDemoSchema)) body: UpdateDemoInput,
  ) {
    return this.demos.update(id, body);
  }

  /** Conversion decision — no Track required (CONTEXT.md). */
  @Post(':id/convert')
  convert(
    @Param('id') id: string,
    @Body(zodPipe(ConvertDemoSchema)) body: ConvertDemoInput,
  ) {
    return this.demos.convert(id, body);
  }

  /** Optional lineage link, set or cleared any time after conversion. */
  @Patch(':id/converted-track')
  linkTrack(
    @Param('id') id: string,
    @Body(zodPipe(LinkConvertedTrackSchema)) body: LinkConvertedTrackInput,
  ) {
    return this.demos.linkConvertedTrack(id, body.convertedTrackId);
  }
}
