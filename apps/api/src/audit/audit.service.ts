import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity) private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  public listRecent(userId: number | string, limit = 20): Promise<AuditLogEntity[]> {
    return this.auditRepo.find({
      where: { actorId: userId.toString() },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
