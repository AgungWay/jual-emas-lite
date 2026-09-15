require("dotenv").config();
const { z } = require("zod");
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.use(express.json());
function auth(req, res, next) {
  const t = req.headers.authorization?.split(" ")[1];
  try {
    req.user = require("jsonwebtoken").verify(
      t,
      process.env.JWT_SECRET || "rahasia",
    );
    next();
  } catch {
    return res.status(401).json({ error: "unauth" });
  }
}
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/employees", auth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id,name,email FROM employees ORDER BY id",
  );
  res.json(rows);
});
app.post("/api/employees", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
  });
  try {
    schema.parse(req.body);
  } catch (e) {
    return res.status(400).json({ error: e.errors ?? e.issues });
  }
  const { name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    "INSERT INTO employees(name,email,password) VALUES($1,$2,$3) RETURNING id,name,email",
    [name, email, hash],
  );
  res.status(201).json(rows[0]);
});

// authentication endpoint with token generation
app.post("/api/auth", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  try {
    schema.parse(req.body);
  } catch (e) {
    return res.status(400).json({ error: e.errors ?? e.issues });
  }
  const { email, password } = req.body;
  const { rows } = await pool.query("SELECT * FROM employees WHERE email=$1", [
    email,
  ]);
  if (rows.length === 0)
    return res.status(401).json({ error: "invalid credentials" });
  const user = rows[0];
  if (!user.password)
    return res
      .status(500)
      .json({ error: "user has no password, reset required" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });
  const token = jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET || "rahasia",
    { expiresIn: "1h" },
  );
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email },
  });
});
// cek token bearer setelah login
app.get("/api/me", auth, async (req, res) => {
  res.json({ user: req.user });
});

app.listen(process.env.PORT, () => console.log("ok :" + process.env.PORT));
