import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { IDeployNotifyResponse } from '@zalobot/contracts';
import { BypassTransform } from '../common/decorators/bypass-transform.decorator';
import { DeployNotifyGuard } from './deploy-notify.guard';
import { DeployNotifyService } from './deploy-notify.service';
import { DeployNotifyDto } from './dto/deploy-notify.dto';

@ApiTags('Deploy')
@BypassTransform()
@UseGuards(DeployNotifyGuard)
@Controller('deploy')
export class DeployController {
  constructor(private readonly deployNotifyService: DeployNotifyService) {}

  @Get('notify')
  @ApiOperation({ summary: 'Gửi thông báo deploy thành công tới Quản trị viên (GET)' })
  @ApiResponse({ status: 200, description: 'Kết quả gửi thông báo deploy' })
  public async notifyDeployGet(@Query() query: DeployNotifyDto): Promise<IDeployNotifyResponse> {
    return this.deployNotifyService.notifyDeploy(query);
  }

  @Post('notify')
  @ApiOperation({ summary: 'Gửi thông báo deploy thành công tới Quản trị viên (POST)' })
  @ApiResponse({ status: 200, description: 'Kết quả gửi thông báo deploy' })
  public async notifyDeployPost(
    @Body() body: DeployNotifyDto,
    @Query() query: DeployNotifyDto,
  ): Promise<IDeployNotifyResponse> {
    return this.deployNotifyService.notifyDeploy({ ...query, ...body });
  }

  @Get('ping')
  @ApiOperation({ summary: 'Ping & gửi thông báo deploy tới Quản trị viên' })
  @ApiResponse({ status: 200, description: 'Kết quả gửi thông báo deploy' })
  public async pingDeploy(@Query() query: DeployNotifyDto): Promise<IDeployNotifyResponse> {
    return this.deployNotifyService.notifyDeploy(query);
  }
}
