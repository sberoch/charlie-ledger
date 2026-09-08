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
  CreateAlbumSchema,
  RenameAlbumSchema,
  type CreateAlbumInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { AlbumsService } from './albums.service';

// Album lookup CRUD — Settings panel plus the Tracks list's album filter and
// summary strip (one list, both consumers). See CONTEXT.md ("Album").
@Controller('albums')
export class AlbumsController {
  constructor(private readonly albums: AlbumsService) {}

  @Get()
  list() {
    return this.albums.list();
  }

  @Post()
  create(
    @Body(zodPipe(CreateAlbumSchema)) body: CreateAlbumInput,
    @Session() session: UserSession,
  ) {
    return this.albums.create(body, session.user.id);
  }

  @Patch(':id')
  rename(
    @Param('id') id: string,
    @Body(zodPipe(RenameAlbumSchema)) body: CreateAlbumInput,
  ) {
    return this.albums.rename(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.albums.remove(id);
  }
}
