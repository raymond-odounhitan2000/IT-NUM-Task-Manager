import { instanceToPlain, plainToInstance } from 'class-transformer';
import { User } from './user.entity';

describe('User entity serialization', () => {
  const raw = {
    id: 'u1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: 'argon2-hash-should-stay-hidden',
    hashedRefreshToken: 'refresh-token-hash-should-stay-hidden',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  it('omits password and hashedRefreshToken when serialized to plain', () => {
    const user = plainToInstance(User, raw);
    const plain = instanceToPlain(user);

    expect(plain).not.toHaveProperty('password');
    expect(plain).not.toHaveProperty('hashedRefreshToken');
  });

  it('keeps public fields in the serialized payload', () => {
    const user = plainToInstance(User, raw);
    const plain = instanceToPlain(user);

    expect(plain).toMatchObject({
      id: 'u1',
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Doe',
    });
  });

  it('preserves password when converting plain to instance (needed for auth check)', () => {
    const user = plainToInstance(User, raw);

    expect(user.password).toBe('argon2-hash-should-stay-hidden');
    expect(user.hashedRefreshToken).toBe(
      'refresh-token-hash-should-stay-hidden',
    );
  });
});
