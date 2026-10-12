import { Module, forwardRef } from '@nestjs/common';
import { MediaStorageService } from './media-storage.service';
import { GoogleModule } from '../google/google.module';

@Module({
  imports: [forwardRef(() => GoogleModule)],
  providers: [MediaStorageService],
  exports: [MediaStorageService],
})
export class ReceiptStorageModule {}
