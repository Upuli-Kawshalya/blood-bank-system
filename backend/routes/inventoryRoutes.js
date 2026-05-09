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

// GET: View all inventory (public - hospitals need to see stock)
router.get('/', async (req, res) => {
  try {
    const [inventory] = await db.query(
      'SELECT * FROM inventory ORDER BY blood_group, expiry_date'
    );
    res.json({ inventory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error fetching inventory' });
  }
});

// POST: Add blood units (admin only)
router.post('/', verifyAdmin, async (req, res) => {
  try {
    const { blood_group, units_available, expiry_date } = req.body;

    // Check if this blood group + expiry already exists
    const [existing] = await db.query(
      'SELECT id FROM inventory WHERE blood_group = ? AND expiry_date = ?',
      [blood_group, expiry_date]
    );

    if (existing.length > 0) {
      // Update existing batch: add units
      await db.query(
        'UPDATE inventory SET units_available = units_available + ? WHERE id = ?',
        [units_available, existing[0].id]
      );
      return res.json({ message: 'Blood units added to existing batch' });
    }

    // Insert new batch
    const sql = 'INSERT INTO inventory (blood_group, units_available, expiry_date) VALUES (?, ?, ?)';
    const values = [blood_group, units_available, expiry_date];
    const [result] = await db.query(sql, values);

    res.status(201).json({ 
      message: 'New blood batch added', 
      inventoryId: result.insertId 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error adding inventory' });
  }
});

// PUT: Update inventory (admin only)
router.put('/:id', verifyAdmin, async (req, res) => {
  try {
    const inventoryId = req.params.id;
    const { units_available, expiry_date } = req.body;

    // Build dynamic update
    const updates = [];
    const values = [];
    if (units_available !== undefined) { updates.push('units_available = ?'); values.push(units_available); }
    if (expiry_date) { updates.push('expiry_date = ?'); values.push(expiry_date); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(inventoryId);
    const sql = `UPDATE inventory SET ${updates.join(', ')} WHERE id = ?`;
    await db.query(sql, values);

    res.json({ message: 'Inventory updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error updating inventory' });
  }
});

// DELETE: Remove expired/used batch (admin only)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const inventoryId = req.params.id;
    await db.query('DELETE FROM inventory WHERE id = ?', [inventoryId]);
    res.json({ message: 'Inventory batch removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error deleting inventory' });
  }
});

// GET: Low-stock & expiring alerts (public)
router.get('/alerts', async (req, res) => {
  try {
    // Low stock: < 5 units
    const [lowStock] = await db.query(
      'SELECT * FROM inventory WHERE units_available < 5 ORDER BY units_available'
    );
    
    // Expiring soon: within 7 days
    const [expiring] = await db.query(
      'SELECT * FROM inventory WHERE expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) ORDER BY expiry_date'
    );

    res.json({
      low_stock: lowStock,
      expiring_soon: expiring,
      message: 'Alerts generated successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error generating alerts' });
  }
});

module.exports = router;