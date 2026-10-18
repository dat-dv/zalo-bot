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
import { UserRole, GrantAccessStatus } from '@zalobot/contracts';
import { getDashboardUserId } from '../dashboard-auth/dashboard-user';
import { ReportsTokenService } from '../reports/reports-token.service';
import { UsersService } from './users.service';

@ApiTags('Users (Admin Only)')
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

  @Post('users/sync-zca')
  @ApiOperation({
    summary: 'Đồng bộ tên, avatar và SĐT từ danh bạ ZCA sang danh sách Users (Admin Only)',
  })
  async syncUsersWithZca(@Req() req: Request) {
    this.admin(req);
    const result = await this.users.syncUsersWithZca();
    return { data: result };
  }

  @Post('users')
  @ApiOperation({ summary: 'Thêm hoặc cập nhật người dùng thủ công' })
  async createUser(@Req() req: Request, @Body() body: Record<string, unknown>) {
    this.admin(req);
    const id = this.id(body.id);
    const role = body.role ? this.role(body.role) : UserRole.USER;
    const grantAccess = this.parseGrantAccess(body.grantAccess, GrantAccessStatus.GRANTED);
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : undefined;
    const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : undefined;
    const avatarUrl = typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : undefined;
    return {
      data: await this.users.upsertUser(id, role, {
        firstName,
        phoneNumber,
        avatarUrl,
        grantAccess,
      }),
    };
  }

  @Patch('users/:id/grant-access')
  @ApiOperation({
    summary: 'Cấp quyền hoặc thu hồi quyền truy cập bot (grantAccess) của người dùng',
  })
  async setGrantAccess(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.admin(req);
    const grantAccess = this.parseGrantAccess(body.grantAccess, GrantAccessStatus.GRANTED);
    const user = await this.users.setGrantAccess(id, grantAccess);
    return { data: user };
  }

  @Patch('users/:id')
  async updateUser(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    this.admin(req);
    let user = await this.users.getUser(id);
    if (!user) throw new NotFoundException();

    if (body.role !== undefined) {
      user = await this.users.updateRole(id, this.role(body.role));
    }
    if (body.grantAccess !== undefined) {
      user = await this.users.setGrantAccess(id, this.parseGrantAccess(body.grantAccess));
    }
    if (
      body.firstName !== undefined ||
      body.phoneNumber !== undefined ||
      body.avatarUrl !== undefined
    ) {
      user = await this.users.updateUserProfile(id, {
        firstName: typeof body.firstName === 'string' ? body.firstName.trim() : undefined,
        phoneNumber: typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : undefined,
        avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl.trim() : undefined,
      });
    }
    return { data: user };
  }

  @Delete('users/:id')
  async deleteUser(@Req() req: Request, @Param('id') id: string) {
    this.admin(req);
    if (!(await this.users.banUser(id)))
      throw new NotFoundException('User not found or is an admin.');
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

  private role(value: unknown): UserRole {
    if (value === UserRole.ADMIN || value === UserRole.USER) return value;
    throw new BadRequestException('role is invalid.');
  }

  private parseGrantAccess(
    value: unknown,
    fallback = GrantAccessStatus.GRANTED,
  ): GrantAccessStatus {
    if (value === undefined || value === null) return fallback;
    return Number(value) === Number(GrantAccessStatus.GRANTED)
      ? GrantAccessStatus.GRANTED
      : GrantAccessStatus.DENIED;
  }
}
