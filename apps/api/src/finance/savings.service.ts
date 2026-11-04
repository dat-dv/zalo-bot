import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ICreateSavingGroupRequest,
  ICreateSavingMovementRequest,
  ISavingGroup,
  ISavingGroupListResponse,
  ISavingMovement,
  IUpdateSavingGroupRequest,
} from '@zalobot/contracts';
import { Repository } from 'typeorm';
import { SavingGroupEntity } from '../database/entities/saving-group.entity';
import { SavingMovementEntity } from '../database/entities/saving-movement.entity';
import { UserEntity } from '../database/entities/user.entity';
import { FinanceService } from './finance.service';
import { savingBalance, toSavingMovementItem } from './saving-ledger';

/** `amount` is a Postgres `integer`. */
const MAX_MOVEMENT_AMOUNT = 2_147_483_647;

function toGroupItem(
  group: SavingGroupEntity,
  movements: readonly SavingMovementEntity[],
): ISavingGroup {
  return {
    id: group.id,
    name: group.name,
    note: group.note ?? undefined,
    balance: savingBalance(movements),
    movementCount: movements.length,
    archivedAt: group.archivedAt?.toISOString(),
    createdByName: group.createdByName ?? undefined,
    createdAt: group.createdAt.toISOString(),
  };
}

@Injectable()
export class SavingsService {
  constructor(
    @InjectRepository(SavingGroupEntity)
    private readonly groupRepo: Repository<SavingGroupEntity>,
    @InjectRepository(SavingMovementEntity)
    private readonly movementRepo: Repository<SavingMovementEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly finance: FinanceService,
  ) {}

  public async listGroups(): Promise<ISavingGroupListResponse> {
    const [groups, movements, position] = await Promise.all([
      this.groupRepo.find({ order: { createdAt: 'ASC', id: 'ASC' } }),
      this.movementRepo.find(),
      this.finance.getLedgerPosition(),
    ]);
    return {
      groups: groups.map((group) =>
        toGroupItem(
          group,
          movements.filter((row) => row.groupId === group.id),
        ),
      ),
      savingsTotal: position.savingsTotal,
      ledgerBalance: position.ledgerBalance,
    };
  }

  public async getGroup(id: string): Promise<ISavingGroup> {
    const group = await this.requireGroup(id);
    return toGroupItem(group, await this.movementRepo.find({ where: { groupId: id } }));
  }

  public async createGroup(
    input: ICreateSavingGroupRequest,
    actorId: string,
  ): Promise<ISavingGroup> {
    const normalizedName = await this.assertNameFree(input.name);
    const group = await this.groupRepo.save(
      this.groupRepo.create({
        name: input.name,
        normalizedName,
        note: input.note ?? null,
        createdByUserId: actorId,
        createdByName: await this.actorName(actorId),
      }),
    );
    return toGroupItem(group, []);
  }

  public async updateGroup(id: string, input: IUpdateSavingGroupRequest): Promise<ISavingGroup> {
    const group = await this.requireGroup(id);
    if (input.name !== undefined) {
      group.normalizedName = await this.assertNameFree(input.name, id);
      group.name = input.name;
    }
    if (input.note !== undefined) group.note = input.note;
    const saved = await this.groupRepo.save(group);
    return toGroupItem(saved, await this.movementRepo.find({ where: { groupId: id } }));
  }

  /** Groups are archived, never removed: their movements are part of the balance history. */
  public async archiveGroup(id: string): Promise<ISavingGroup> {
    return this.groupRepo.manager.transaction(async (manager) => {
      const group = await manager.findOne(SavingGroupEntity, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!group) throw new NotFoundException('Không tìm thấy nhóm tiết kiệm.');
      const movements = await manager.find(SavingMovementEntity, { where: { groupId: id } });
      if (savingBalance(movements) !== 0) {
        throw new ConflictException('Nhóm còn tiền, hãy rút hết trước khi lưu trữ.');
      }
      if (!group.archivedAt) {
        group.archivedAt = new Date();
        await manager.save(SavingGroupEntity, group);
      }
      return toGroupItem(group, movements);
    });
  }

  public async listMovements(groupId: string): Promise<ISavingMovement[]> {
    const group = await this.requireGroup(groupId);
    const rows = await this.movementRepo.find({
      where: { groupId },
      order: { occurredAt: 'DESC', createdAt: 'DESC', id: 'DESC' },
    });
    return rows.map((row) => toSavingMovementItem(row, group.name));
  }

  public async addMovement(
    groupId: string,
    input: ICreateSavingMovementRequest,
    actorId: string,
  ): Promise<ISavingMovement> {
    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestException('Số tiền phải là số nguyên lớn hơn 0.');
    }
    if (input.amount > MAX_MOVEMENT_AMOUNT) {
      throw new BadRequestException('Số tiền quá lớn.');
    }
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ.');
    }
    const createdByName = await this.actorName(actorId);
    return this.groupRepo.manager.transaction(async (manager) => {
      // The row lock makes two withdrawals at once see each other's result.
      const group = await manager.findOne(SavingGroupEntity, {
        where: { id: groupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!group) throw new NotFoundException('Không tìm thấy nhóm tiết kiệm.');
      if (group.archivedAt) throw new ConflictException('Nhóm này đã được lưu trữ.');
      if (input.type === 'withdrawal') {
        const movements = await manager.find(SavingMovementEntity, { where: { groupId } });
        const balance = savingBalance(movements);
        if (input.amount > balance) {
          throw new ConflictException(
            `Nhóm chỉ còn ${balance.toLocaleString('vi-VN')}đ, không rút được số này.`,
          );
        }
      }
      const saved = await manager.save(
        SavingMovementEntity,
        manager.create(SavingMovementEntity, {
          groupId,
          type: input.type,
          amount: input.amount,
          occurredAt,
          note: input.note ?? null,
          createdByUserId: actorId,
          createdByName,
        }),
      );
      return toSavingMovementItem(saved, group.name);
    });
  }

  public async removeMovement(groupId: string, movementId: string): Promise<void> {
    await this.groupRepo.manager.transaction(async (manager) => {
      const group = await manager.findOne(SavingGroupEntity, {
        where: { id: groupId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!group) throw new NotFoundException('Không tìm thấy nhóm tiết kiệm.');
      if (group.archivedAt) throw new ConflictException('Nhóm này đã được lưu trữ.');
      const movements = await manager.find(SavingMovementEntity, { where: { groupId } });
      const movement = movements.find((row) => row.id === movementId);
      if (!movement) throw new NotFoundException('Không tìm thấy lượt nạp/rút.');
      const remaining = movements.filter((row) => row.id !== movementId);
      if (savingBalance(remaining) < 0) {
        throw new ConflictException(
          'Không xoá được: số tiền này đã được rút, xoá lượt rút trước đã.',
        );
      }
      await manager.remove(SavingMovementEntity, movement);
    });
  }

  private async requireGroup(id: string): Promise<SavingGroupEntity> {
    const group = await this.groupRepo.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Không tìm thấy nhóm tiết kiệm.');
    return group;
  }

  /** Archived groups keep their name reserved so the two never read the same in the audit log. */
  private async assertNameFree(name: string, ownId?: string): Promise<string> {
    const normalizedName = this.finance.normalizeIdentity(name);
    if (!normalizedName) throw new BadRequestException('Tên nhóm không hợp lệ.');
    const existing = await this.groupRepo.findOne({ where: { normalizedName } });
    if (existing && existing.id !== ownId) {
      throw new ConflictException('Đã có nhóm tiết kiệm tên này (kể cả nhóm đã lưu trữ).');
    }
    return normalizedName;
  }

  private async actorName(actorId: string): Promise<string | null> {
    const user = await this.userRepo.findOne({ where: { id: actorId } });
    return user?.firstName?.trim() || null;
  }
}
