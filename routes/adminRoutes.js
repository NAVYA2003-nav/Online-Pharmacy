const express = require('express');
const router = express.Router();
const db = require('../config/db'); // MySQL connection

router.get('/dashboard', (req, res) => {
    // Fetch products
    db.query('SELECT * FROM products', (err, productResults) => {
        if (err) {
            console.log(err);
            return res.send('Database error');
        }

        // Count total products
        const totalProducts = productResults.length;

        // Fetch total orders count
        db.query('SELECT COUNT(*) AS totalOrders FROM orders', (err2, orderResults) => {
            if (err2) {
                console.log(err2);
                return res.send('Database error');
            }

            const totalOrders = orderResults[0].totalOrders;

            // ✅ Fetch all orders so we can display them in adminDashboard
            db.query('SELECT * FROM orders', (err3, orders) => {
                if (err3) {
                    console.log(err3);
                    return res.send('Database error');
                }

                // ✅ Render and pass everything needed to EJS
                res.render('adminDashboard', {
                    admin: req.session.admin || null,   // pass logged in admin
                    products: productResults,
                    totalProducts,
                    totalOrders,
                    orders  // ✅ now orders are available in your EJS
                });
            });
        });
    });
});

// Toggle availability
router.post("/toggle/:id", (req, res) => {
  const productId = req.params.id;

  db.query("SELECT available FROM products WHERE id = ?", [productId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Error checking product");
    }

    if (result.length > 0) {
      const currentStatus = result[0].available;
      const newStatus = currentStatus == 1 ? 0 : 1;

      db.query("UPDATE products SET available = ? WHERE id = ?", [newStatus, productId], (err2) => {
        if (err2) {
          console.error(err2);
          return res.status(500).send("Error updating product");
        }
        res.redirect("/admin/dashboard"); // back to dashboard
      });
    } else {
      res.status(404).send("Product not found");
    }
  });
});

// ============================
// ✅ Update Product Stock
// ============================
router.post("/update-stock/:id", (req, res) => {
  if (!req.session.admin) return res.redirect("/admin/login");

  const productId = req.params.id;
  const { stock } = req.body;

  db.query(
    "UPDATE products SET stock = ? WHERE id = ?",
    [stock, productId],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Database error");
      }

      // if stock is 0, mark product unavailable automatically
      if (stock <= 0) {
        db.query("UPDATE products SET available = 0 WHERE id = ?", [productId]);
      }

      res.redirect("/admin/dashboard");
    }
  );
});


module.exports = router;
