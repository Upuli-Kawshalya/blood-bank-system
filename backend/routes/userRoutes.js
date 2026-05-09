const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// POST: Register a new user
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, password } = req.body;

    // 1. Check if user already exists
    const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // 2. Hash the password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 3. Insert into Database
    const sql = 'INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)';
    const values = [full_name, email, password_hash, 'donor'];

    const [result] = await db.query(sql, values);

    // 4. Send Success Response
    res.status(201).json({ 
      message: 'User registered successfully', 
      userId: result.insertId 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// POST: Login a user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user by email
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = users[0];

    // 2. Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 3. Generate JWT token (valid for 1 hour)
    const token = jwt.sign(
      { userId: user.id, role: user.role }, 
      'your_secret_key_here', // In production: use process.env.JWT_SECRET
      { expiresIn: '1h' }
    );

    // 4. Send token + user info (without password)
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Middleware: Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]; // "Bearer TOKEN"
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, 'your_secret_key_here');
    req.user = decoded; // Attach user info to request
    next(); // Continue to the route
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// GET: Protected route - only logged-in users can access
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, full_name, email, role FROM users WHERE id = ?', [req.user.userId]);
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: users[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ EXPORT MUST BE AT THE END!
module.exports = router;