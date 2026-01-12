// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../app');

// Admin Dashboard
router.get('/dashboard', (req, res) => {
  res.render('admin', { page: 'admin' });
});

module.exports = router;
