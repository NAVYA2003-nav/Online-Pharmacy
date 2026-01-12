// app.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');   // ✅ For password hashing
const userConfig = require("./user");

const app = express();
app.use("/uploads", express.static("uploads"));
app.use("/images", express.static(path.join(__dirname, "public/images")));
app.use(express.static("public"));

// ✅ MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'online_pharmacy'
});
db.connect((err) => {
  if (err) console.log(err);
  else console.log('✅ Connected to MySQL');
});
module.exports.db = db;

// ✅ View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ✅ Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Session
app.use(
  session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
  })
);

// Make session user/admin available in all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.admin = req.session.admin || null;
  next();
});

// ✅ Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/images'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage: storage });

// ✅ Routes
const productRoutes = require('./routes/productRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/', productRoutes);
app.use('/admin', adminRoutes);

// ========================================================
// ✅ USER AUTH
app.get('/register', (req, res) => {
  res.render('register', { page: 'register', error: null });
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword],
      (err) => {
        if (err) {
          console.log(err);
          return res.render('register', { page: 'register', error: "❌ Email already exists!" });
        }
        res.redirect('/login');
      }
    );
  } catch (err) {
    console.log(err);
    res.render('register', { page: 'register', error: "❌ Something went wrong!" });
  }
});

app.get('/login', (req, res) => {
  res.render('login', { page: 'login', error: null });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      const user = results[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        req.session.user = { id: user.id, email: user.email, name: user.name };
        return res.redirect('/products');
      }
    }
    res.render('login', { page: 'login', error: "❌ Invalid email or password!" });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ========================================================
// ✅ CART
app.get('/cart', (req, res) => {
  if (!req.session.cart) req.session.cart = [];
  res.render('cart', { cart: req.session.cart });
});

// instead of app.get('/cart/add/:id'...)
app.post('/cart/add/:id', (req, res) => {
  const productId = req.params.id;
  db.query('SELECT * FROM products WHERE id = ?', [productId], (err, results) => {
    if (err) throw err;
    if (results.length > 0) {
      let product = results[0];
      if (!req.session.cart) req.session.cart = [];

      let existing = req.session.cart.find(item => item.id == product.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        product.quantity = 1;
        product.price = parseFloat(product.price);
        product.stock = product.stock;   // ✅ store stock with item
        req.session.cart.push(product);
      }

      res.redirect('/cart');
    } else {
      res.redirect('/products');
    }
  });
});



// Remove item
app.get('/cart/remove/:id', (req, res) => {
  const productId = req.params.id;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter(item => item.id != productId);
  }
  res.redirect('/cart');
});

// Update cart quantity
app.post('/cart/update/:id', (req, res) => {
  const productId = req.params.id;
  const { action } = req.body;

  if (!req.session.cart) req.session.cart = [];

  const item = req.session.cart.find(i => i.id == productId);
  if (item) {
    if (action === "increase") item.quantity++;
    else if (action === "decrease" && item.quantity > 1) item.quantity--;
  }

  res.redirect('/cart');
});
// Increase quantity
app.post("/cart/increase/:id", (req, res) => {
  const productId = req.params.id;
  if (!req.session.cart) req.session.cart = [];
  let item = req.session.cart.find(i => i.id == productId);

  if (item) {
    // ✅ Check stock from DB
    db.query("SELECT stock FROM products WHERE id = ?", [productId], (err, results) => {
      if (!err && results.length > 0) {
        const stock = results[0].stock;

        // ✅ Only increase if current qty < stock
        if (item.quantity < stock) {
          item.quantity++;
        } else {
          // Optional: show message in console/log
          console.log(`⚠️ Stock limit reached for product ${productId}`);
        }
      }
      res.redirect("/cart");
    });
  } else {
    res.redirect("/cart");
  }
});

// Decrease quantity
app.post("/cart/decrease/:id", (req, res) => {
  const productId = req.params.id;
  if (!req.session.cart) req.session.cart = [];
  let item = req.session.cart.find(i => i.id == productId);

  if (item && item.quantity > 1) {
    item.quantity--;
  }
  res.redirect("/cart");
});
// ✅ Checkout Page
//app.get("/cart/checkout", (req, res) => {
  //const cart = req.session.cart || [];
  //if (cart.length === 0) {
    //return res.redirect("/cart");
  //}
  //res.render("checkout", { cart });
//});




// ========================================================
// ✅ CHECKOUT + ORDERS (only one handler)
app.get('/checkout', (req, res) => {
  res.render('checkout', { cart: req.session.cart || [] });
});

app.post('/checkout', upload.single("prescription"), (req, res) => {
  const { name, address, payment } = req.body;
  const cart = req.session.cart || [];

  let total = 0;
  cart.forEach(item => total += item.price * item.quantity);

  const prescription = req.file ? "/uploads/" + req.file.filename : null;

  // Insert into orders table
  db.query(
    "INSERT INTO orders (name, address, payment, total, prescription) VALUES (?, ?, ?, ?, ?)",
    [name, address, payment, total, prescription],
    (err, result) => {
      if (err) throw err;

      // Update stock
      cart.forEach(item => {
        db.query(
          "UPDATE products SET stock = stock - ? WHERE id = ?",
          [item.quantity, item.id],
          (err2) => {
            if (err2) console.error("Stock update error:", err2);
            db.query(
              "UPDATE products SET available = 0 WHERE id = ? AND stock <= 0",
              [item.id],
              (err3) => {
                if (err3) console.error("Availability update error:", err3);
              }
            );
          }
        );
      });

      req.session.lastOrderName = name;
      req.session.cart = [];

      res.render("thankyou", { name, address, payment, total });
    }
  );
});

// ========================================================
// ✅ ORDER HISTORY
app.get("/orders/history", (req, res) => {
  const name = req.session.lastOrderName;
  const { month, year, payment } = req.query;

  if (!name) {
    return res.render("orderHistory", { orders: [], message: "⚠️ You don’t have any past orders.", query: req.query });
  }

  let sql = "SELECT * FROM orders WHERE name = ?";
  let params = [name];

  if (month) {
    sql += " AND MONTH(order_date) = ?";
    params.push(month);
  }
  if (year) {
    sql += " AND YEAR(order_date) = ?";
    params.push(year);
  }
  if (payment) {
    sql += " AND payment = ?";
    params.push(payment);
  }

  sql += " ORDER BY order_date DESC";

  db.query(sql, params, (err, orders) => {
    if (err) throw err;
    orders = orders.map(o => ({ ...o, total: parseFloat(o.total) }));
    res.render("orderHistory", { orders, message: orders.length === 0 ? "⚠️ No orders found for this filter." : null, query: req.query });
  });
});

// ✅ REORDER
app.get("/orders/reorder/:id", (req, res) => {
  const orderId = req.params.id;

  db.query("SELECT * FROM orders WHERE id = ?", [orderId], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      return res.redirect("/orders/history");
    }

    const order = results[0];

    // ✅ Fix: convert total into a number
    order.total = parseFloat(order.total);

    // ✅ Save reorder details in session
    req.session.reorder = {
      name: order.name,
      address: order.address,
      payment: order.payment,
      total: order.total
    };

    // ✅ Redirect to payment page
    res.redirect("/orders/payment");
  });
});
// ✅ Show Payment Page (GET)
app.get("/orders/payment", (req, res) => {
  if (!req.session.reorder) {
    return res.redirect("/orders/history"); // if no reorder in session
  }

  const order = req.session.reorder;
  order.total = parseFloat(order.total); // ensure number

  res.render("payment", { order });
});

// ✅ Handle Payment (POST)
app.post("/orders/payment", (req, res) => {
  if (!req.session.reorder) {
    return res.redirect("/orders/history");
  }

  const order = req.session.reorder;

  // Save this reorder as a new order
  db.query(
    "INSERT INTO orders (name, address, payment, total) VALUES (?, ?, ?, ?)",
    [order.name, order.address, order.payment, order.total],
    (err) => {
      if (err) throw err;

      // Clear reorder session
      req.session.reorder = null;

      res.render("thankyou", {
        name: order.name,
        address: order.address,
        payment: order.payment,
        total: order.total
      });
    }
  );
});



// ========================================================
// ✅ AUTO CREATE ADMIN
const { email: adminEmail, password: adminPassword } = userConfig.admin;

db.query("SELECT * FROM admins WHERE email = ?", [adminEmail], async (err, results) => {
  if (err) throw err;

  if (results.length === 0) {
    try {
      const hashed = await bcrypt.hash(adminPassword, 10);
      db.query(
        "INSERT INTO admins (email, password) VALUES (?, ?)",
        [adminEmail, hashed],
        (err) => {
          if (err) throw err;
          console.log("✅ Default admin created:", adminEmail);
        }
      );
    } catch (hashErr) {
      console.log("❌ Error hashing admin password:", hashErr);
    }
  } else {
    console.log("ℹ️ Admin already exists:", adminEmail);
  }
});

// ========================================================
// ✅ ADMIN LOGIN + DASHBOARD
app.get("/admin/login", (req, res) => {
  res.render("adminLogin", { error: null });
});

app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM admins WHERE email = ?", [email], (err, results) => {
    if (err) throw err;
    if (results.length === 0) {
      return res.render("adminLogin", { error: "❌ Invalid admin credentials!" });
    }

    const admin = results[0];

    bcrypt.compare(password, admin.password, (err, isMatch) => {
      if (err) throw err;
      if (isMatch) {
        req.session.admin = { id: admin.id, email: admin.email };
        res.redirect("/admin/dashboard");
      } else {
        res.render("adminLogin", { error: "❌ Invalid admin credentials!" });
      }
    });
  });
});

app.get("/admin/dashboard", (req, res) => {
  if (!req.session.admin) return res.redirect("/admin/login");

  // Fetch all products
  db.query("SELECT * FROM products", (err, products) => {
    if (err) throw err;

    const totalProducts = products.length;

    // Count total orders
    db.query("SELECT COUNT(*) AS totalOrders FROM orders", (err2, orderResult) => {
      if (err2) throw err2;
      const totalOrders = orderResult[0].totalOrders;

      // Fetch sold quantity per product
      db.query(
        `SELECT product_id, SUM(quantity) as sold_quantity
         FROM order_items
         GROUP BY product_id`,
        (err3, sold) => {
          if (err3) throw err3;

          // Map sold quantities to products
          const productsWithSold = products.map(p => {
            const soldItem = sold.find(s => s.product_id === p.id);
            return { ...p, sold_quantity: soldItem ? soldItem.sold_quantity : 0 };
          });

          res.render("adminDashboard", {
            admin: req.session.admin,
            products: productsWithSold,
            totalProducts,
            totalOrders
          });
        }
      );
    });
  });
});





// Add product (with image upload)
app.post("/admin/products/add", upload.single("image"), (req, res) => {
  if (!req.session.admin) return res.redirect("/admin/login");
  const { name, description, price } = req.body;
  const image = req.file ? "/images/" + req.file.filename : null;

  db.query(
    "INSERT INTO products (name, description, price, image) VALUES (?, ?, ?, ?)",
    [name, description, price, image],
    (err) => {
      if (err) throw err;
      res.redirect("/admin/dashboard");
    }
  );
});

app.get("/admin/products/toggle/:id", (req, res) => {
  const productId = req.params.id;

  db.query("SELECT available FROM products WHERE id = ?", [productId], (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      const currentStatus = results[0].available;
      const newStatus = currentStatus === 1 ? 0 : 1;

      db.query("UPDATE products SET available = ? WHERE id = ?", [newStatus, productId], (err2) => {
        if (err2) throw err2;
        res.redirect("/admin/dashboard");
      });
    } else {
      res.redirect("/admin/dashboard");
    }
  });
});

// Edit product
app.post("/admin/products/edit/:id", (req, res) => {
  if (!req.session.admin) return res.redirect("/admin/login");
  const { name, description, price } = req.body;
  const productId = req.params.id;
  db.query(
    "UPDATE products SET name=?, description=?, price=? WHERE id=?",
    [name, description, price, productId],
    (err) => {
      if (err) throw err;
      res.redirect("/admin/dashboard");
    }
  );
});

// Delete product
app.get("/admin/products/delete/:id", (req, res) => {
  if (!req.session.admin) return res.redirect("/admin/login");
  const productId = req.params.id;
  db.query("DELETE FROM products WHERE id=?", [productId], (err) => {
    if (err) throw err;
    res.redirect("/admin/dashboard");
  });
});

// ========================================================

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
