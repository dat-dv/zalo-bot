import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { GoogleCalendarService } from './google-calendar.service';
import { UserTokenEntity } from '../database/entities/user-token.entity';
import { TokenEncryptionService } from './token-encryption.service';
import { GoogleResourcesController } from './google-resources.controller';
import { DashboardAuthModule } from '../dashboard-auth/dashboard-auth.module';
import { UsersModule } from '../users/users.module';
import { ZcaModule } from '../zca/zca.module';

import { GoogleDriveService } from './google-drive.service';
import { GooglePhotosService } from './google-photos.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserTokenEntity]),
    DashboardAuthModule,
    forwardRef(() => UsersModule),
    forwardRef(() => ZcaModule),
  ],
  controllers: [GoogleAuthController, GoogleResourcesController],
  providers: [
    GoogleAuthService,
    GoogleCalendarService,
    GoogleDriveService,
    GooglePhotosService,
    TokenEncryptionService,
  ],
  exports: [GoogleAuthService, GoogleCalendarService, GoogleDriveService, GooglePhotosService],
})
export class GoogleModule {}
