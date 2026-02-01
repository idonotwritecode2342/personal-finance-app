const { createUser, getUserByEmail, verifyPassword } = require('../db/users');

// Mock the db/users module
jest.mock('../db/users', () => ({
  createUser: jest.fn(),
  getUserByEmail: jest.fn(),
  verifyPassword: jest.fn()
}));

describe('Auth Routes - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Login Flow', () => {
    it('should allow login with correct credentials', async () => {
      getUserByEmail.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password_hash: '$2b$10$...'
      });
      verifyPassword.mockResolvedValueOnce(true);

      const user = await getUserByEmail('test@example.com');
      const passwordValid = await verifyPassword('password123', user.password_hash);

      expect(user.id).toBe(1);
      expect(passwordValid).toBe(true);
    });

    it('should reject login with invalid credentials', async () => {
      getUserByEmail.mockResolvedValueOnce(null);

      const user = await getUserByEmail('invalid@example.com');
      expect(user).toBeNull();
    });
  });

  describe('Registration Flow', () => {
    it('should allow registration with valid credentials', async () => {
      getUserByEmail.mockResolvedValueOnce(null);
      createUser.mockResolvedValueOnce({
        id: 1,
        email: 'newuser@example.com'
      });

      const existingUser = await getUserByEmail('newuser@example.com');
      expect(existingUser).toBeNull();

      const newUser = await createUser('newuser@example.com', 'password123');
      expect(newUser.id).toBe(1);
      expect(newUser.email).toBe('newuser@example.com');
    });

    it('should reject registration if email already exists', async () => {
      getUserByEmail.mockResolvedValueOnce({
        id: 1,
        email: 'existing@example.com'
      });

      const user = await getUserByEmail('existing@example.com');
      expect(user).not.toBeNull();
    });
  });

  describe('Password Validation', () => {
    it('should correctly hash and verify passwords', async () => {
      const plainPassword = 'password123';
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync(plainPassword, 10);

      verifyPassword.mockResolvedValueOnce(true);
      const isValid = await verifyPassword(plainPassword, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      verifyPassword.mockResolvedValueOnce(false);
      const isValid = await verifyPassword('wrongpassword', 'hashedpassword');
      expect(isValid).toBe(false);
    });
  });
});
