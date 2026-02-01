const express = require('express');
const { createUser, getUserByEmail, verifyPassword } = require('../db/users');

const router = express.Router();

// GET login page
router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'Login', error: null });
});

// POST login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.render('login', { title: 'Login', error: 'Email and password are required' });
  }

  try {
    const user = await getUserByEmail(email);

    if (!user) {
      return res.render('login', { title: 'Login', error: 'Invalid email or password' });
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.render('login', { title: 'Login', error: 'Invalid email or password' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.userEmail = user.email;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    res.render('login', { title: 'Login', error: 'An error occurred. Please try again.' });
  }
});

// GET register page
router.get('/register', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('register', { title: 'Register', error: null });
});

// POST register
router.post('/register', async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (!email || !password || !confirmPassword) {
    return res.render('register', { title: 'Register', error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.render('register', { title: 'Register', error: 'Passwords do not match' });
  }

  if (password.length < 6) {
    return res.render('register', { title: 'Register', error: 'Password must be at least 6 characters' });
  }

  try {
    const existingUser = await getUserByEmail(email);

    if (existingUser) {
      return res.render('register', { title: 'Register', error: 'Email already in use' });
    }

    const newUser = await createUser(email, password);

    // Set session
    req.session.userId = newUser.id;
    req.session.userEmail = newUser.email;

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Registration error:', err);
    res.render('register', { title: 'Register', error: 'An error occurred. Please try again.' });
  }
});

// GET logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.render('error', { title: 'Error', message: 'Could not logout' });
    }
    res.redirect('/login');
  });
});

module.exports = router;
