import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IContactUserSyncResult } from '@zalobot/contracts';
import { DebtContactEntity } from '../database/entities/debt-contact.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UsersService } from '../users/users.service';
import { FinanceService } from './finance.service';
import { fillMissingPhones, planContactUserSync } from './contact-user-sync';

/** Đưa người dùng Zalo vào danh bạ công nợ của admin (nút "Đồng bộ người dùng Zalo"). */
@Injectable()
export class ContactUserSyncService {
  constructor(
    @InjectRepository(DebtContactEntity)
    private readonly contactRepo: Repository<DebtContactEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly finance: FinanceService,
    @Inject(forwardRef(() => UsersService))
    private readonly users: UsersService,
  ) {}

  public async syncUsersIntoContacts(ownerId: number | string): Promise<IContactUserSyncResult> {
    const owner = ownerId.toString();
    const [users, contacts] = await Promise.all([
      this.userRepo.find({ order: { createdAt: 'ASC' } }),
      this.contactRepo.find({ where: { userId: owner } }),
    ]);
    const plan = planContactUserSync({
      ownerId: owner,
      users,
      contacts,
      isBotAccount: (id) => this.users.isBotAccount(id),
      normalize: (value) => this.finance.normalizeIdentity(value),
    });

    let phoneFilled = 0;
    const contactsToSave: DebtContactEntity[] = [];
    const usersToSave: UserEntity[] = [];

    for (const { user, displayName } of plan.create) {
      const phoneNumber = user.phoneNumber?.trim() || undefined;
      if (phoneNumber) phoneFilled++;
      contactsToSave.push(
        this.contactRepo.create({
          userId: owner,
          displayName,
          normalizedName: this.finance.normalizeIdentity(displayName),
          phoneNumber,
          avatarUrl: user.avatarUrl || undefined,
          linkedUserId: user.id,
          linkedUser: user,
        }),
      );
    }

    for (const { user, contact } of plan.linked) {
      const fill = fillMissingPhones(contact.phoneNumber, user.phoneNumber);
      if (fill.contactPhone) {
        contact.phoneNumber = fill.contactPhone;
        contactsToSave.push(contact);
        phoneFilled++;
      }
      if (fill.userPhone) {
        user.phoneNumber = fill.userPhone;
        usersToSave.push(user);
        phoneFilled++;
      }
    }

    if (contactsToSave.length > 0) await this.contactRepo.save(contactsToSave);
    if (usersToSave.length > 0) await this.userRepo.save(usersToSave);

    return { created: plan.create.length, phoneFilled, suggestions: plan.suggestions };
  }
}
