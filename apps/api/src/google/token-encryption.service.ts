import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { decryptSecret, encryptSecret, parseEncryptionKey } from '../common/crypto/secret-cipher';

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const key = parseEncryptionKey(config.getOrThrow<string>('security.encryptionKey'));
    if (!key) {
      throw new Error('DATA_ENCRYPTION_KEY must be a 64-character hexadecimal key.');
    }
    this.key = key;
  }

  public encrypt(value?: string): string | undefined {
    return encryptSecret(value, this.key);
  }

  public decrypt(value?: string): string | undefined {
    try {
      return decryptSecret(value, this.key);
    } catch {
      throw new Error('Unable to decrypt stored Google token.');
    }
  }
}
