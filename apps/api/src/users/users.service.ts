import { Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { UserSession } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import {
  UpdateUserSchema,
  type UpdateUserDto,
  type UserDto,
} from '@workspace/shared';
import { auth } from '../auth/auth';

@Injectable()
export class UsersService {
  toDto(user: UserSession['user']): UserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
    };
  }

  async updateMe(req: Request, body: UpdateUserDto): Promise<UserDto> {
    const data = UpdateUserSchema.parse(body);
    await auth.api.updateUser({
      body: data,
      headers: fromNodeHeaders(req.headers),
    });
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) throw new Error('No session');
    return this.toDto(session.user);
  }
}
