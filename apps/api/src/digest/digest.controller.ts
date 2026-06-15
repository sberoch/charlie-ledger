import { Controller, Get, Post } from '@nestjs/common';
import { DigestService } from './digest.service';

@Controller('digest')
export class DigestController {
  constructor(private readonly digest: DigestService) {}

  /** What next Monday's email would contain — used by Settings as a preview. */
  @Get('preview')
  preview() {
    return this.digest.build();
  }

  /** Manual trigger, mostly for verifying the Resend wiring. */
  @Post('send-now')
  async sendNow() {
    return this.digest.send(await this.digest.build());
  }
}
