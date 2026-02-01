const { createUser, getUserByEmail, getUserById, verifyPassword } = require('../db/users');
const pool = require('../db/connection');

// Mock the database pool
jest.mock('../db/connection', () => ({
  query: jest.fn()
}));

describe('User Database Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user with hashed password', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, email: 'test@example.com' }]
      });

      const result = await createUser('test@example.com', 'password123');

      expect(pool.query).toHaveBeenCalledWith(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
        ['test@example.com', expect.any(String)]
      );
      expect(result).toEqual({ id: 1, email: 'test@example.com' });
    });

    it('should reject on database error', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(createUser('test@example.com', 'password123'))
        .rejects.toThrow('Database error');
    });
  });

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      const mockUser = { id: 1, email: 'test@example.com', password_hash: 'hashed' };
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await getUserByEmail('test@example.com');

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT id, email, password_hash FROM users WHERE email = $1',
        ['test@example.com']
      );
      expect(result).toEqual(mockUser);
    });

    it('should return undefined if user not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await getUserByEmail('notfound@example.com');

      expect(result).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('should return user by id', async () => {
      const mockUser = { id: 1, email: 'test@example.com', created_at: new Date() };
      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await getUserById(1);

      expect(pool.query).toHaveBeenCalledWith(
        'SELECT id, email, created_at FROM users WHERE id = $1',
        [1]
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', async () => {
      // Using bcryptjs synchronous methods for testing
      const plainPassword = 'password123';
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync(plainPassword, 10);

      const result = await verifyPassword(plainPassword, hashedPassword);
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('password123', 10);

      const result = await verifyPassword('wrongpassword', hashedPassword);
      expect(result).toBe(false);
    });
  });
});
