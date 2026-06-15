import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  AddUserSchema,
  UpdateAppSettingsSchema,
  type AddUserInput,
  type UpdateAppSettingsInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Patch()
  update(@Body(zodPipe(UpdateAppSettingsSchema)) body: UpdateAppSettingsInput) {
    return this.settings.update(body);
  }

  @Get('users')
  listUsers() {
    return this.settings.listUsers();
  }

  @Post('users')
  addUser(@Body(zodPipe(AddUserSchema)) body: AddUserInput) {
    return this.settings.addUser(body);
  }
}
