const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Middleware: Verify JWT token (same as before)
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, 'your_secret_key_here');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// POST: Create donor profile (after registration)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { blood_group, weight_kg } = req.body;
    const userId = req.user.userId;

    // Check if donor profile already exists
    const [existing] = await db.query('SELECT id FROM donors WHERE user_id = ?', [userId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Donor profile already exists' });
    }

    // Insert new donor
    const sql = 'INSERT INTO donors (user_id, blood_group, weight_kg, is_eligible) VALUES (?, ?, ?, ?)';
    const values = [userId, blood_group, weight_kg, true];
    const [result] = await db.query(sql, values);

    res.status(201).json({ 
      message: 'Donor profile created', 
      donorId: result.insertId 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error creating donor profile' });
  }
});

// GET: View donor profile
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const donorId = req.params.id;
    const userId = req.user.userId;

    // Security: Only let users view their own profile
    const [donors] = await db.query(
      'SELECT d.*, u.full_name, u.email FROM donors d JOIN users u ON d.user_id = u.id WHERE d.id = ? AND d.user_id = ?', 
      [donorId, userId]
    );

    if (donors.length === 0) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    res.json({ donor: donors[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching donor profile' });
  }
});

// PUT: Update donor profile
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const donorId = req.params.id;
    const userId = req.user.userId;
    const { blood_group, weight_kg, is_eligible } = req.body;

    // Security: Only let users update their own profile
    const [check] = await db.query('SELECT id FROM donors WHERE id = ? AND user_id = ?', [donorId, userId]);
    if (check.length === 0) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    // Build dynamic update query (only update fields that were sent)
    const updates = [];
    const values = [];
    if (blood_group) { updates.push('blood_group = ?'); values.push(blood_group); }
    if (weight_kg) { updates.push('weight_kg = ?'); values.push(weight_kg); }
    if (is_eligible !== undefined) { updates.push('is_eligible = ?'); values.push(is_eligible); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(donorId, userId);
    const sql = `UPDATE donors SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;
    await db.query(sql, values);

    res.json({ message: 'Donor profile updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating donor profile' });
  }
});

module.exports = router;