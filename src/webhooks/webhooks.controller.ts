// src/webhooks/webhooks.controller.ts
import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { WebhooksService } from './webhooks.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Public()
  @Post('bbb')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle BigBlueButton webhooks' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleBBBWebhook(
    @Body() payload: any,
    @Headers('x-bbb-signature') signature?: string,
  ) {
    console.log('Received BBB signature:', signature);
    // In production, verify the webhook signature
    // const isValidSignature = this.verifySignature(payload, signature);
    // if (!isValidSignature) {
    //   throw new UnauthorizedException('Invalid webhook signature');
    // }

    await this.webhooksService.handleBigBlueButtonWebhook(payload);
    return { status: 'ok' };
  }
}
