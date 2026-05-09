const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Middleware: Verify JWT token
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

// POST: Book an appointment
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { appointment_date, time_slot } = req.body;

    // 1. Validate date (must be today or future)
    const today = new Date().toISOString().split('T')[0];
    if (appointment_date < today) {
      return res.status(400).json({ error: 'Date must be today or in the future' });
    }

    // 2. Check if slot is already booked
    const [existing] = await db.query(
      'SELECT id FROM appointments WHERE appointment_date = ? AND time_slot = ? AND status != ?',
      [appointment_date, time_slot, 'cancelled']
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // 3. Create appointment
    const sql = 'INSERT INTO appointments (user_id, appointment_date, time_slot) VALUES (?, ?, ?)';
    const values = [userId, appointment_date, time_slot];
    const [result] = await db.query(sql, values);

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointmentId: result.insertId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error booking appointment' });
  }
});

// GET: View my appointments
router.get('/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [appointments] = await db.query(
      'SELECT id, appointment_date, time_slot, status, created_at FROM appointments WHERE user_id = ? ORDER BY appointment_date DESC',
      [userId]
    );
    res.json({ appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching appointments' });
  }
});

module.exports = router;