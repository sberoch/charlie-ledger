import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Runtime boundary for the shared zod contracts:
 *
 *   @Body(zodPipe(CreateLicenseSchema)) body: CreateLicenseInput
 *   @Query(zodPipe(LicenseListQuerySchema)) query: LicenseListQuery
 *
 * Returns the parsed (trimmed/coerced) value, so handlers receive what the
 * schema says — not what the client sent.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}

export function zodPipe<T>(schema: ZodType<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}
