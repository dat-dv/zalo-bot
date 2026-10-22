import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BypassTransform } from '../common/decorators/bypass-transform.decorator';

@ApiTags('Health')
@BypassTransform()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check endpoint for load balancers / Coolify' })
  @ApiResponse({ status: 200, description: 'Service is up and running' })
  public check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
