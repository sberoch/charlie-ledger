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
  CreateBrandCategorySchema,
  CreateBrandSchema,
  CreatePayerSchema,
  RenameBrandCategorySchema,
  UpdateBrandSchema,
  UpdatePayerSchema,
  type CreateBrandCategoryInput,
  type CreateBrandInput,
  type CreatePayerInput,
  type UpdateBrandInput,
  type UpdatePayerInput,
} from '@workspace/shared';
import { zodPipe } from '../common/zod-validation.pipe';
import { PartiesService } from './parties.service';

// POSTs are find-or-create by case-insensitive name (idempotent combobox).
@Controller()
export class PartiesController {
  constructor(private readonly parties: PartiesService) {}

  @Get('brand-categories')
  listCategories(@Query('search') search?: string) {
    return this.parties.listCategories(search);
  }

  @Post('brand-categories')
  createCategory(
    @Body(zodPipe(CreateBrandCategorySchema)) body: CreateBrandCategoryInput,
    @Session() session: UserSession,
  ) {
    return this.parties.createCategory(body, session.user.id);
  }

  @Patch('brand-categories/:id')
  renameCategory(
    @Param('id') id: string,
    @Body(zodPipe(RenameBrandCategorySchema)) body: CreateBrandCategoryInput,
  ) {
    return this.parties.renameCategory(id, body);
  }

  @Get('brands')
  listBrands(@Query('search') search?: string) {
    return this.parties.listBrands(search);
  }

  @Post('brands')
  createBrand(
    @Body(zodPipe(CreateBrandSchema)) body: CreateBrandInput,
    @Session() session: UserSession,
  ) {
    return this.parties.createBrand(body, session.user.id);
  }

  @Patch('brands/:id')
  updateBrand(
    @Param('id') id: string,
    @Body(zodPipe(UpdateBrandSchema)) body: UpdateBrandInput,
  ) {
    return this.parties.updateBrand(id, body);
  }

  @Get('payers')
  listPayers(@Query('search') search?: string) {
    return this.parties.listPayers(search);
  }

  @Post('payers')
  createPayer(
    @Body(zodPipe(CreatePayerSchema)) body: CreatePayerInput,
    @Session() session: UserSession,
  ) {
    return this.parties.createPayer(body, session.user.id);
  }

  @Patch('payers/:id')
  updatePayer(
    @Param('id') id: string,
    @Body(zodPipe(UpdatePayerSchema)) body: UpdatePayerInput,
  ) {
    return this.parties.updatePayer(id, body);
  }
}
