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
  CreateTagSchema,
  RenameTagSchema,
  type CreateTagInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { TagsService } from './tags.service';

// The governed tag vocabulary CRUD, consumed by the Settings screen. Distinct
// from GET /tracks/tags (the in-use filter chips) by responsibility.
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list() {
    return this.tags.list();
  }

  @Post()
  create(
    @Body(zodPipe(CreateTagSchema)) body: CreateTagInput,
    @Session() session: UserSession,
  ) {
    return this.tags.create(body, session.user.id);
  }

  @Patch(':id')
  rename(
    @Param('id') id: string,
    @Body(zodPipe(RenameTagSchema)) body: CreateTagInput,
  ) {
    return this.tags.rename(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tags.remove(id);
  }
}
