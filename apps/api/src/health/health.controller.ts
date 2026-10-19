import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { IDeployNotifyResponse } from '@zalobot/contracts';
import { BypassTransform } from '../common/decorators/bypass-transform.decorator';
import { DeployNotifyGuard } from './deploy-notify.guard';
import { DeployNotifyService } from './deploy-notify.service';
import { DeployNotifyDto } from './dto/deploy-notify.dto';

@ApiTags('Health')
@BypassTransform()
@Controller('health')
export class HealthController {
  constructor(private readonly deployNotifyService: DeployNotifyService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint for load balancers / Coolify' })
  @ApiResponse({ status: 200, description: 'Service is up and running' })
  public check(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('deploy')
  @UseGuards(DeployNotifyGuard)
  @ApiOperation({
    summary: 'Gửi thông báo deploy thành công tới Quản trị viên (GET /health/deploy)',
  })
  @ApiResponse({ status: 200, description: 'Kết quả gửi thông báo deploy' })
  public async notifyDeployGet(@Query() query: DeployNotifyDto): Promise<IDeployNotifyResponse> {
    return this.deployNotifyService.notifyDeploy(query);
  }

  @Post('deploy')
  @UseGuards(DeployNotifyGuard)
  @ApiOperation({
    summary: 'Gửi thông báo deploy thành công tới Quản trị viên (POST /health/deploy)',
  })
  @ApiResponse({ status: 200, description: 'Kết quả gửi thông báo deploy' })
  public async notifyDeployPost(
    @Body() body: DeployNotifyDto,
    @Query() query: DeployNotifyDto,
  ): Promise<IDeployNotifyResponse> {
    return this.deployNotifyService.notifyDeploy({ ...query, ...body });
  }
}
