import { Controller, Get } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { ZcaConnectionState } from '@zalobot/contracts';
import { BypassTransform } from '../common/decorators/bypass-transform.decorator';
import { ZcaService } from '../zca/zca.service';

@ApiTags('Health')
@BypassTransform()
@Controller('health')
export class HealthController {
  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Always 200, whatever ZCA is doing: Coolify restarts a failing container, and that would also
   * take down the dashboard an admin needs to scan a new QR code. Monitors read `zca` instead.
   */
  @Get()
  @ApiOperation({ summary: 'Health check endpoint for load balancers / Coolify' })
  @ApiResponse({ status: 200, description: 'Service is up and running' })
  public check(): { status: string; zca: ZcaConnectionState; timestamp: string } {
    const zca = this.moduleRef.get(ZcaService, { strict: false });
    return {
      status: 'ok',
      zca: zca.getConnectionStatus().state,
      timestamp: new Date().toISOString(),
    };
  }
}
