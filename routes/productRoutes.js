// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const { db } = require('../app'); // Import the db connection from app.js

// Route: Home page (optional)
router.get('/', (req, res) => {
  res.render('home', { page: 'home' });
});

// Route: Show all products
router.get('/products', (req, res) => {
  // ✅ Ensure stock & available are fetched
  const sql = 'SELECT id, name, description, category, price, image, stock, available FROM products';
  
  db.query(sql, (err, results) => {
    if (err) {
      console.log(err);
      return res.send('Database error');
    }

    // ✅ Ensure numbers are parsed correctly
    results = results.map(p => ({
      ...p,
      stock: parseInt(p.stock),
      available: parseInt(p.available)
    }));

    res.render('products', { products: results, page: 'products' });
  });
});

module.exports = router;
