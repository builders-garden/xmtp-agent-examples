import { existsSync } from "fs";
import { fromString } from "uint8arrays";

export function loadEnvFile() {
  // Only do this in the gm example because it's called from the root
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  } else if (existsSync(`../../.env`)) {
    process.loadEnvFile(`../../.env`);
  }
}

/**
 * Get encryption key from string
 * @param encryptionKey - The encryption key string
 * @returns The encryption key
 */
export const getEncryptionKeyFromString = (encryptionKey: string) => {
  return fromString(encryptionKey);
};
