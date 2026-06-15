import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import type { UpdateUserDto, UserDto } from '@workspace/shared';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@Session() session: UserSession): UserDto {
    return this.users.toDto(session.user);
  }

  @Patch('me')
  update(@Req() req: Request, @Body() body: UpdateUserDto): Promise<UserDto> {
    return this.users.updateMe(req, body);
  }
}
