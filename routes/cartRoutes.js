// routes/cartRoutes.js
const express = require("express");
const router = express.Router();
const { db } = require("../app");

// ✅ Initialize cart session if not exists
function initCart(req) {
  if (!req.session.cart) req.session.cart = [];
}

// 🛒 View Cart
router.get("/", (req, res) => {
  initCart(req);
  res.render("cart", { cart: req.session.cart });
});

// 🛒 Add to Cart (GET version for <a href>)
router.get("/add/:id", (req, res) => {
  initCart(req);

  const productId = req.params.id;

  db.query("SELECT * FROM products WHERE id = ?", [productId], (err, results) => {
    if (err) {
      console.error(err);
      return res.redirect("/products");
    }

    if (results.length > 0) {
      let product = results[0];
      let existing = req.session.cart.find(item => item.id == product.id);

      if (existing) {
        // ✅ Check stock before increasing
        if (existing.quantity < product.stock) {
          existing.quantity += 1;
        }
      } else {
        product.quantity = 1;
        product.price = parseFloat(product.price);
        product.id = product.id.toString();
        req.session.cart.push(product);
      }
    }

    res.redirect("/cart");
  });
});

// 🛒 Remove item from cart
router.get("/remove/:id", (req, res) => {
  initCart(req);
  const productId = req.params.id;
  req.session.cart = req.session.cart.filter(item => item.id != productId);
  res.redirect("/cart");
});

// 🛒 Increase Quantity
router.post("/increase/:id", (req, res) => {
  initCart(req);
  const productId = req.params.id;

  db.query("SELECT stock FROM products WHERE id = ?", [productId], (err, results) => {
    if (err) {
      console.error(err);
      return res.redirect("/cart");
    }

    let item = req.session.cart.find(i => i.id == productId);
    if (item && results.length > 0) {
      let stock = results[0].stock;
      if (item.quantity < stock) {
        item.quantity++;
      }
    }

    res.redirect("/cart");
  });
});

// 🛒 Decrease Quantity
router.post("/decrease/:id", (req, res) => {
  initCart(req);
  const productId = req.params.id;

  let item = req.session.cart.find(i => i.id == productId);
  if (item && item.quantity > 1) {
    item.quantity--;
  }

  res.redirect("/cart");
});

// 🛒 Checkout
router.get("/checkout", (req, res) => {
  initCart(req);
  if (req.session.cart.length === 0) {
    return res.redirect("/cart");
  }
  res.render("checkout", { cart: req.session.cart });
});

module.exports = router;
