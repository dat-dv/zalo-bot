import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { UsersService } from './users.service';

@ApiTags('Users & Invitations (Admin Only)')
@ApiBearerAuth('bearer-jwt')
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: ReportsTokenService,
  ) {}

  @Get('users')
  @ApiOperation({ summary: 'Lấy danh sách người dùng trong hệ thống (Yêu cầu quyền Admin)' })
  async listUsers(@Req() req: Request) {
    this.admin(req);
    return { data: await this.users.getUsers() };
  }

  @Get('users/:id')
  async getUser(@Req() req: Request, @Param('id') id: string) {
    this.admin(req);
    const user = await this.users.getUser(id);
    if (!user) throw new NotFoundException();
    return { data: user };
  }

  @Post('users')
  async createUser(@Req() req: Request, @Body() body: Record<string, unknown>) {
    this.admin(req);
    return { data: await this.users.upsertUser(this.id(body.id), this.role(body.role)) };
  }

  @Patch('users/:id')
  async updateUser(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.admin(req);
    const user = await this.users.updateRole(id, this.role(body.role));
    if (!user) throw new NotFoundException();
    return { data: user };
  }

  @Delete('users/:id')
  async deleteUser(@Req() req: Request, @Param('id') id: string) {
    this.admin(req);
    if (!(await this.users.banUser(id)))
      throw new NotFoundException('User not found or is an admin.');
    return { data: { deleted: true } };
  }

  @Get('invites')
  async listInvites(@Req() req: Request) {
    this.admin(req);
    return { data: await this.users.listInvites() };
  }

  @Post('invites')
  async createInvite(@Req() req: Request) {
    return { data: await this.users.createInvite(this.admin(req)) };
  }

  @Delete('invites/:code')
  async revokeInvite(@Req() req: Request, @Param('code') code: string) {
    this.admin(req);
    if (!(await this.users.revokeInvite(code))) throw new NotFoundException();
    return { data: { deleted: true } };
  }

  private admin(req: Request): string | number {
    const userId = getDashboardUserId(req, this.tokens);
    if (!this.users.isAdmin(userId)) throw new ForbiddenException();
    return userId;
  }
  private id(value: unknown): string {
    const id = (typeof value === 'string' || typeof value === 'number' ? String(value) : '').trim();
    if (!id) throw new BadRequestException('id is invalid.');
    return id;
  }
  private role(value: unknown): 'admin' | 'user' {
    if (value === 'admin' || value === 'user') return value;
    throw new BadRequestException('role is invalid.');
  }
}
