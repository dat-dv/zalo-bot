import { Module, forwardRef } from '@nestjs/common';
import { MediaStorageService } from './media-storage.service';
import { GoogleModule } from '../google/google.module';
import { ChannelStorageLinkModule } from '../zca/storage/channel-storage-link.module';

@Module({
  imports: [forwardRef(() => GoogleModule), ChannelStorageLinkModule],
  providers: [MediaStorageService],
  exports: [MediaStorageService],
})
export class ReceiptStorageModule {}
