const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config(); // Load environment variables

const app = express();
app.use(cors());
app.use(express.json());

// Configure Multer for file uploads (This is for development. See note below for production)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Ensure the uploads directory exists (for local development)
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Database connection using environment variables
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err.stack);
    return;
  }
  console.log("Connected to database.");
});

// Get all products with pagination
app.get("/products", (req, res) => {
  const { _page = 1, _limit = 5 } = req.query;
  const offset = (_page - 1) * _limit;
  const limit = parseInt(_limit, 10);

  const query = `SELECT * FROM products LIMIT ? OFFSET ?`;
  db.query(query, [limit, offset], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err });
    }

    // Get total count of products for pagination
    db.query("SELECT COUNT(*) AS count FROM products", (err, countResult) => {
      if (err) {
        return res.status(500).json({ error: err });
      }

      const total = countResult[0].count;
      res.setHeader("x-total-count", total);
      res.json(results);
    });
  });
});

// Get distinct group names
app.get("/groups", (req, res) => {
  const query = "SELECT DISTINCT group_name FROM products";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Get distinct raw material types
app.get("/raw-material-types", (req, res) => {
  const query = "SELECT DISTINCT raw_material_type FROM products";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Get distinct machine types
app.get("/machine-types", (req, res) => {
  const query = "SELECT DISTINCT machine_type FROM products";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Get distinct MO numbers
app.get("/mo-numbers", (req, res) => {
  const query = "SELECT DISTINCT mo_number FROM products";
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Get product details by ID
app.get("/products/:id", (req, res) => {
  const { id } = req.params;
  const query = "SELECT * FROM products WHERE id = ?";
  db.query(query, [id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(results[0]);
  });
});

// Create a new product
app.post("/products", upload.single("photo"), (req, res) => {
  const {
    name,
    group_name,
    size,
    packaging,
    color,
    price,
    raw_material_type,
    machine_type,
    mo_number,
  } = req.body;
  const photo_url = req.file ? req.file.filename : null; // Save file name in DB
  const query =
    "INSERT INTO products (name, group_name, size, packaging, color, price, raw_material_type, machine_type, mo_number, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  db.query(
    query,
    [
      name,
      group_name,
      size,
      packaging,
      color,
      price,
      raw_material_type,
      machine_type,
      mo_number,
      photo_url,
    ],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err });
      }
      res.status(201).json({
        message: "Product created successfully",
        productId: results.insertId,
      });
    }
  );
});

// Update a product
app.put("/products/:id", upload.single("photo"), (req, res) => {
  const { id } = req.params;
  const {
    name,
    group_name,
    size,
    packaging,
    color,
    price,
    raw_material_type,
    machine_type,
    mo_number,
  } = req.body;
  const photo_url = req.file ? req.file.filename : null;

  // Get current product photo URL
  db.query(
    "SELECT photo_url FROM products WHERE id = ?",
    [id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err });
      }
      const oldPhotoUrl = results[0]?.photo_url;
      const query =
        "UPDATE products SET name = ?, group_name = ?, size = ?, packaging = ?, color = ?, price = ?, raw_material_type = ?, machine_type = ?, mo_number = ?, photo_url = ? WHERE id = ?";
      db.query(
        query,
        [
          name,
          group_name,
          size,
          packaging,
          color,
          price,
          raw_material_type,
          machine_type,
          mo_number,
          photo_url,
          id,
        ],
        (err, results) => {
          if (err) {
            return res.status(500).json({ error: err });
          }
          if (oldPhotoUrl && photo_url && oldPhotoUrl !== photo_url) {
            fs.unlink(`uploads/${oldPhotoUrl}`, (err) => {
              if (err) console.error("Failed to delete old image:", err);
            });
          }
          res.json({ message: "Product updated successfully" });
        }
      );
    }
  );
});

// Delete a product
app.delete("/products/:id", (req, res) => {
  const { id } = req.params;
  // Get current product photo URL
  db.query(
    "SELECT photo_url FROM products WHERE id = ?",
    [id],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err });
      }
      const photo_url = results[0]?.photo_url;
      const query = "DELETE FROM products WHERE id = ?";
      db.query(query, [id], (err, results) => {
        if (err) {
          return res.status(500).json({ error: err });
        }
        if (photo_url) {
          fs.unlink(`uploads/${photo_url}`, (err) => {
            if (err) console.error("Failed to delete image:", err);
          });
        }
        res.json({ message: "Product deleted successfully" });
      });
    }
  );
});

// Serve static files (for development)
app.use("/uploads", express.static("uploads"));

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
