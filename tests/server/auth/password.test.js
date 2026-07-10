import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, validatePolicy } from '@server/auth/password.js';

describe('password', () => {
  it('rejects passwords shorter than 12 chars', () => {
    expect(validatePolicy('short1!A')).toEqual({ ok: false, reason: 'min_length' });
  });

  it('rejects common passwords', () => {
    expect(validatePolicy('password1234')).toEqual({ ok: false, reason: 'common' });
  });

  it('accepts a strong password', () => {
    expect(validatePolicy('zX9!muPpetDance#Lurking')).toEqual({ ok: true });
  });

  it('hashes and verifies', async () => {
    const hash = await hashPassword('zX9!muPpetDance#Lurking');
    expect(await verifyPassword('zX9!muPpetDance#Lurking', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
