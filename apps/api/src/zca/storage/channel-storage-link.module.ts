import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChannelStorageLinkEntity } from '../../database/entities/channel-storage-link.entity';
import { ChannelStorageLinkService } from './channel-storage-link.service';

/** Standalone so ReceiptStorageModule (writes on upload) and ZcaModule (lists) avoid a cycle. */
@Module({
  imports: [TypeOrmModule.forFeature([ChannelStorageLinkEntity])],
  providers: [ChannelStorageLinkService],
  exports: [ChannelStorageLinkService],
})
export class ChannelStorageLinkModule {}
