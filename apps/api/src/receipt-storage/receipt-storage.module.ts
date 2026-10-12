import { Module, forwardRef } from '@nestjs/common';
import { ReceiptImageStorageService } from './receipt-image-storage.service';
import { MediaStorageService } from './media-storage.service';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [forwardRef(() => GoogleModule)],
  providers: [ReceiptImageStorageService, MediaStorageService],
  exports: [ReceiptImageStorageService, MediaStorageService],
})
export class ReceiptStorageModule {}
