import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Same fallback as `RedisService`, so local runs without `REDIS_URL` still find Redis. */
const DEFAULT_REDIS_URL = 'redis://localhost:6379';

/**
 * BullMQ connection shared by every queue. Workers open their own ioredis connections
 * (not the `RedisService` client), and BullMQ requires `maxRetriesPerRequest: null` on them.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('redis.url') || process.env.REDIS_URL || DEFAULT_REDIS_URL,
          maxRetriesPerRequest: null,
        },
        prefix: 'zalobot',
      }),
    }),
  ],
})
export class QueueModule {}
