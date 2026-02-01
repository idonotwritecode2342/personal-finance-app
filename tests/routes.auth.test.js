const request = require('supertest');
const express = require('express');
const session = require('express-session');
const authRoutes = require('../routes/auth');

// Create test app
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'test-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, httpOnly: true }
}));
app.use('/', authRoutes);

// Mock the db/users module
jest.mock('../db/users', () => ({
  createUser: jest.fn(),
  getUserByEmail: jest.fn(),
  verifyPassword: jest.fn()
}));

const { createUser, getUserByEmail, verifyPassword } = require('../db/users');

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /login', () => {
    it('should render login page', async () => {
      const response = await request(app)
        .get('/login')
        .expect(200);

      expect(response.text).toContain('login');
    });

    it('should redirect to dashboard if already logged in', async () => {
      const response = await request(app)
        .get('/login')
        .set('Cookie', ['connect.sid=test'])
        .expect(302);

      // Session middleware would redirect if userId set
    });
  });

  describe('POST /login', () => {
    it('should login with correct credentials', async () => {
      getUserByEmail.mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password_hash: '$2b$10$...'
      });
      verifyPassword.mockResolvedValueOnce(true);

      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect(302);

      expect(response.headers.location).toContain('/dashboard');
    });

    it('should reject with invalid credentials', async () => {
      getUserByEmail.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/login')
        .send({ email: 'invalid@example.com', password: 'password123' })
        .expect(200);

      expect(response.text).toContain('Invalid email or password');
    });

    it('should reject if email or password missing', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(response.text).toContain('required');
    });
  });

  describe('GET /register', () => {
    it('should render register page', async () => {
      const response = await request(app)
        .get('/register')
        .expect(200);

      expect(response.text).toContain('register');
    });
  });

  describe('POST /register', () => {
    it('should register new user', async () => {
      getUserByEmail.mockResolvedValueOnce(null);
      createUser.mockResolvedValueOnce({
        id: 1,
        email: 'newuser@example.com'
      });

      const response = await request(app)
        .post('/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        })
        .expect(302);

      expect(response.headers.location).toContain('/dashboard');
    });

    it('should reject if passwords do not match', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          confirmPassword: 'differentpassword'
        })
        .expect(200);

      expect(response.text).toContain('do not match');
    });

    it('should reject if password too short', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          email: 'test@example.com',
          password: 'short',
          confirmPassword: 'short'
        })
        .expect(200);

      expect(response.text).toContain('at least 6 characters');
    });

    it('should reject if email already exists', async () => {
      getUserByEmail.mockResolvedValueOnce({
        id: 1,
        email: 'existing@example.com'
      });

      const response = await request(app)
        .post('/register')
        .send({
          email: 'existing@example.com',
          password: 'password123',
          confirmPassword: 'password123'
        })
        .expect(200);

      expect(response.text).toContain('already in use');
    });
  });

  describe('GET /logout', () => {
    it('should logout and redirect to login', async () => {
      const response = await request(app)
        .get('/logout')
        .expect(302);

      expect(response.headers.location).toContain('/login');
    });
  });
});
