import { describe, it, expect } from 'vitest';
import { genererCodeInvitation } from '../../src/commun/domain/CodeInvitation.js';

describe('genererCodeInvitation', () => {
  it('génère un code de 6 caractères', () => {
    expect(genererCodeInvitation()).toHaveLength(6);
  });

  it('n\'utilise que des caractères non ambigus (pas de 0/O ni 1/I)', () => {
    const code = genererCodeInvitation();
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });

  it('génère des codes différents sur plusieurs appels (au sens probabiliste)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => genererCodeInvitation()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
