require("dotenv").config();
const { z } = require("zod");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const app = express();
const prisma = new PrismaClient();
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
app.get("/api/employees", async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const cursor = req.query.cursor ? parseInt(req.query.cursor) : null;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const { role, sortBy = "id", order = "asc", search } = req.query;

  const where = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const allowedSort = ["id", "name", "email", "role", "salary", "createdAt"];
  const sortField = allowedSort.includes(sortBy) ? sortBy : "id";
  const sortOrder = order === "desc" ? "desc" : "asc";
  const includeTotal = req.query.count !== "false";

  // CURSOR pagination — O(log n) seek, no OFFSET. Only valid when sorting by PK.
  if (cursor) {
    if (sortField !== "id") {
      return res
        .status(400)
        .json({ error: "cursor pagination only supports sortBy=id" });
    }
    const cursorOp = sortOrder === "asc" ? "gt" : "lt";
    const employees = await prisma.employee.findMany({
      where: { ...where, id: { [cursorOp]: cursor } },
      select: { id: true, name: true, email: true, role: true, salary: true },
      orderBy: { id: sortOrder },
      take: limit,
    });
    const nextCursor =
      employees.length === limit ? employees[employees.length - 1].id : null;
    return res.json({
      data: employees,
      pagination: { limit, nextCursor, hasMore: !!nextCursor },
      filter: { role: role || null, search: search || null },
      sort: { sortBy: sortField, order: sortOrder },
    });
  }

  // OFFSET pagination — keep for compat, but avoid COUNT(*) when not needed
  const skip = (page - 1) * limit;
  if (!includeTotal) {
    const employees = await prisma.employee.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, salary: true },
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limit,
    });
    return res.json({
      data: employees,
      pagination: { page, limit },
      filter: { role: role || null, search: search || null },
      sort: { sortBy: sortField, order: sortOrder },
    });
  }

  const [employees, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, salary: true },
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);

  res.json({
    data: employees,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    filter: { role: role || null, search: search || null },
    sort: { sortBy: sortField, order: sortOrder },
  });
});
app.post("/api/employees", auth, async (req, res) => {
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
  try {
    const employee = await prisma.employee.create({
      data: { name, email, password: hash },
      select: { id: true, name: true, email: true },
    });
    res.status(201).json(employee);
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "email already exists" });
    }
    throw e;
  }
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
  const user = await prisma.employee.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "invalid credentials" });
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

// ── PRODUCTS (simple) ──
app.get("/api/products", async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { id: "asc" } });
  res.json(products);
});

app.get("/api/products/:id", async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!product) return res.status(404).json({ error: "product not found" });
  res.json(product);
});

// ── CUSTOMERS (simple) ──
app.get("/api/customers", async (req, res) => {
  const customers = await prisma.customer.findMany({ orderBy: { id: "asc" } });
  res.json(customers);
});

app.get("/api/customers/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!customer) return res.status(404).json({ error: "customer not found" });
  res.json(customer);
});

// ── TRANSACTIONS (simple) ──
app.get("/api/transactions", async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    orderBy: { id: "desc" },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      employee: { select: { id: true, name: true, email: true } },
      items: { include: { product: true } },
    },
  });
  res.json(transactions);
});

app.get("/api/transactions/:id", async (req, res) => {
  const tx = await prisma.transaction.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      customer: true,
      employee: { select: { id: true, name: true, email: true } },
      items: { include: { product: true } },
    },
  });
  if (!tx) return res.status(404).json({ error: "transaction not found" });
  res.json(tx);
});

app.listen(process.env.PORT, () => console.log("ok :" + process.env.PORT));

// graceful shutdown prisma
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
