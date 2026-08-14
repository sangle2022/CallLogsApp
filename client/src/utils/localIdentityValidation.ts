import { LocalIdentity } from '../types/CallLog.types';

export interface IdentityValidationErrors {
  name?: string;
  phoneNumber?: string;
}

export function normalizePhoneNumber(value: string): string {
  const trimmed = String(value || '').trim();

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  return hasPlus ? `+${digits}` : digits;
}

export function validateLocalIdentity(
  identity: LocalIdentity,
): IdentityValidationErrors {
  const errors: IdentityValidationErrors = {};

  const name = String(identity.name || '').trim();
  const phoneNumber = normalizePhoneNumber(identity.phoneNumber);
  const phoneDigits = phoneNumber.replace(/\D/g, '');

  if (!name) {
    errors.name = 'Name is required.';
  } else if (name.length < 2) {
    errors.name = 'Name must contain at least 2 characters.';
  } else if (name.length > 80) {
    errors.name = 'Name cannot be longer than 80 characters.';
  }

  if (!phoneNumber) {
    errors.phoneNumber = 'Phone number is required.';
  } else if (phoneDigits.length < 10) {
    errors.phoneNumber = 'Enter a valid phone number.';
  } else if (phoneDigits.length > 15) {
    errors.phoneNumber = 'Phone number cannot contain more than 15 digits.';
  }

  return errors;
}

export function isIdentityValid(identity: LocalIdentity): boolean {
  return Object.keys(validateLocalIdentity(identity)).length === 0;
}