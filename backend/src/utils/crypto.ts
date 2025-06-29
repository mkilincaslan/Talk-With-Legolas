import { randomBytes, scryptSync } from 'crypto';

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;

// Hashes a password using scrypt with a random salt
export const hashPassword = (password: string): string => {
  // Generate a random salt
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${hash}`;
};

// Verifies a password against a stored hash
export const verifyPassword = (password: string, hashedPassword: string): boolean => {
  const [salt, storedHash] = hashedPassword.split(':');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return storedHash === hash;
};
