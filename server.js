const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const { Parser } = require("json2csv");
const ExcelJS = require("exceljs");
require("dotenv").config(); // load environment variables

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || "supersecretkey",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // set true if using HTTPS
}));

// Database connection using environment variables
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || "rotaract_db"
});

// Ensure connection works
db.connect(err => {
  if (err) {
    console.error("Database connection failed:", err.stack);
    return;
  }
  console.log("Connected to MySQL database:", process.env.DB_NAME || "rotaract_db");
});

// Create tables if not exist
db.query(`
  CREATE TABLE IF NOT EXISTS charter_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(10),
    first_name VARCHAR(50),
    middle_name VARCHAR(50),
    last_name VARCHAR(50),
    gender VARCHAR(20),
    dob DATE,
    club_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    alt_phone VARCHAR(20),
    city VARCHAR(50),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(50)
  )
`);

db.query(`
  CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(20) DEFAULT 'admin'
  )
`);

// Middleware to protect admin routes
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized. Please log in." });
  }
  next();
}

// Middleware to require superadmin role
function requireSuperAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ message: "Unauthorized." });
  db.query("SELECT role FROM admins WHERE id = ?", [req.session.userId], (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ message: "Unauthorized." });
    if (results[0].role !== "superadmin") return res.status(403).json({ message: "Forbidden. Super-admins only." });
    next();
  });
}

// Register admin (superadmin only)
app.post("/register", requireSuperAdmin, async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO admins (username, password_hash, role) VALUES (?, ?, 'admin')",
      [username, hashed],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Error registering admin." });
        }
        res.json({ message: "Admin registered successfully!" });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.query("SELECT * FROM admins WHERE username = ?", [username], async (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ message: "Invalid credentials." });
    const match = await bcrypt.compare(password, results[0].password_hash);
    if (!match) return res.status(401).json({ message: "Invalid credentials." });
    req.session.userId = results[0].id;
    res.json({ message: "Login successful!", role: results[0].role });
  });
});

// Logout
app.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ message: "Logged out successfully." });
});

// Handle form submission
app.post("/submit", (req, res) => {
  const data = req.body;
  const sql = `
    INSERT INTO charter_members 
    (title, first_name, middle_name, last_name, gender, dob, club_name, email, phone, alt_phone, city, state, postal_code, country)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const values = [
    data.title, data.first_name, data.middle_name, data.last_name,
    data.gender, data.dob, data.club_name, data.email, data.phone,
    data.alt_phone, data.city, data.state, data.postal_code, data.country
  ];

  db.query(sql, values, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error saving member." });
    }
    res.json({ message: "Member submitted successfully!" });
  });
});

// Get all members (protected)
app.get("/members", requireLogin, (req, res) => {
  db.query("SELECT * FROM charter_members", (err, results) => {
    if (err) return res.status(500).json({ message: "Error retrieving members." });
    res.json(results);
  });
});

// Export as CSV (protected)
app.get("/export/csv", requireLogin, (req, res) => {
  db.query("SELECT * FROM charter_members", (err, results) => {
    if (err) return res.status(500).json({ message: "Error exporting CSV." });
    if (!results.length) return res.json({ message: "No members to export." });
    const fields = Object.keys(results[0]);
    const parser = new Parser({ fields });
    const csv = parser.parse(results);
    res.header("Content-Type", "text/csv");
    res.attachment("charter_members.csv");
    res.send(csv);
  });
});

// Export as Excel (protected)
app.get("/export/excel", requireLogin, async (req, res) => {
  db.query("SELECT * FROM charter_members", async (err, results) => {
    if (err) return res.status(500).json({ message: "Error exporting Excel." });
    if (!results.length) return res.json({ message: "No members to export." });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Charter Members");
    worksheet.columns = Object.keys(results[0]).map(key => ({ header: key, key: key, width: 20 }));
    results.forEach(row => worksheet.addRow(row));
    res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.attachment("charter_members.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  });
});

// Delete a member submission (protected)
app.delete("/members/:id", requireLogin, (req, res) => {
  const memberId = req.params.id;
  db.query("DELETE FROM charter_members WHERE id = ?", [memberId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Error deleting member." });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Member not found." });
    }
    res.json({ message: "Member deleted successfully!" });
  });
});

// Flexible port for hosting
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
