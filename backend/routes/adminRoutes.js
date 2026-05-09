const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');

// Middleware: Verify JWT + Check if admin
const verifyAdmin = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, 'your_secret_key_here');
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// GET: View all appointments (with user info)
router.get('/appointments', verifyAdmin, async (req, res) => {
  try {
    const [appointments] = await db.query(`
      SELECT a.id, a.appointment_date, a.time_slot, a.status, 
             u.full_name, u.email, d.blood_group
      FROM appointments a
      JOIN users u ON a.user_id = u.id
      LEFT JOIN donors d ON u.id = d.user_id
      ORDER BY a.appointment_date DESC
    `);
    res.json({ appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching appointments' });
  }
});

// PUT: Confirm an appointment
router.put('/appointments/:id/confirm', verifyAdmin, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    await db.query('UPDATE appointments SET status = ? WHERE id = ?', ['confirmed', appointmentId]);
    res.json({ message: 'Appointment confirmed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error confirming appointment' });
  }
});

// PUT: Cancel an appointment
router.put('/appointments/:id/cancel', verifyAdmin, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    await db.query('UPDATE appointments SET status = ? WHERE id = ?', ['cancelled', appointmentId]);
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error cancelling appointment' });
  }
});

// GET: Inventory stats
router.get('/stats/inventory', verifyAdmin, async (req, res) => {
  try {
    // Total units by blood group
    const [byGroup] = await db.query(`
      SELECT blood_group, SUM(units_available) as total_units 
      FROM inventory 
      GROUP BY blood_group
    `);
    
    // Low stock count
    const [lowStock] = await db.query(
      'SELECT COUNT(*) as count FROM inventory WHERE units_available < 5'
    );
    
    // Expiring soon count
    const [expiring] = await db.query(
      'SELECT COUNT(*) as count FROM inventory WHERE expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)'
    );

    res.json({
      by_blood_group: byGroup,
      low_stock_count: lowStock[0].count,
      expiring_soon_count: expiring[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching inventory stats' });
  }
});

// GET: Donor stats
router.get('/stats/donors', verifyAdmin, async (req, res) => {
  try {
    // Total donors
    const [total] = await db.query('SELECT COUNT(*) as count FROM donors');
    
    // Donors by blood group
    const [byGroup] = await db.query(`
      SELECT d.blood_group, COUNT(*) as count 
      FROM donors d 
      GROUP BY d.blood_group
    `);
    
    // Eligible vs ineligible
    const [eligibility] = await db.query(`
      SELECT is_eligible, COUNT(*) as count 
      FROM donors 
      GROUP BY is_eligible
    `);

    res.json({
      total_donors: total[0].count,
      by_blood_group: byGroup,
      eligibility_breakdown: eligibility
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching donor stats' });
  }
});

module.exports = router;