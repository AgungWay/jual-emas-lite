require("dotenv").config();
const { z } = require("zod");
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── Auth ──
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "missing token - expected Authorization: Bearer <token>" });
  }
  const token = header.split(" ")[1];
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "rahasia");
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ error: "token expired" });
    return res.status(401).json({ error: "invalid token" });
  }
}

async function handleLogin(req, res) {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { email, password } = parsed.data;
  const user = await prisma.employee.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "invalid credentials" });
  if (!user.password) return res.status(500).json({ error: "user has no password, reset required" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "invalid credentials" });
  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "rahasia", { expiresIn: "1h" });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
}

// ── Routes ──
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Auth (public)
app.post("/api/auth", handleLogin);
app.post("/api/auth/login", handleLogin);

// Employees (protected)
app.get("/api/employees", auth, async (req, res) => {
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

  if (cursor) {
    if (sortField !== "id") return res.status(400).json({ error: "cursor pagination only supports sortBy=id" });
    const cursorOp = sortOrder === "asc" ? "gt" : "lt";
    const employees = await prisma.employee.findMany({
      where: { ...where, id: { [cursorOp]: cursor } },
      select: { id: true, name: true, email: true, role: true, salary: true },
      orderBy: { id: sortOrder },
      take: limit,
    });
    const nextCursor = employees.length === limit ? employees[employees.length - 1].id : null;
    return res.json({
      data: employees,
      pagination: { limit, nextCursor, hasMore: !!nextCursor },
      filter: { role: role || null, search: search || null },
      sort: { sortBy: sortField, order: sortOrder },
    });
  }

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
  const schema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { name, email, password } = parsed.data;
  const hash = await bcrypt.hash(password, 10);
  try {
    const employee = await prisma.employee.create({
      data: { name, email, password: hash },
      select: { id: true, name: true, email: true },
    });
    res.status(201).json(employee);
  } catch (e) {
    if (e.code === "P2002") return res.status(409).json({ error: "email already exists" });
    throw e;
  }
});

// Products
app.get("/api/products", async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { id: "asc" } });
  res.json(products);
});

app.get("/api/products/:id", async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: Number(req.params.id) } });
  if (!product) return res.status(404).json({ error: "product not found" });
  res.json(product);
});

// Customers
app.get("/api/customers", async (req, res) => {
  const customers = await prisma.customer.findMany({ orderBy: { id: "asc" } });
  res.json(customers);
});

app.get("/api/customers/:id", async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: Number(req.params.id) } });
  if (!customer) return res.status(404).json({ error: "customer not found" });
  res.json(customer);
});

// Transactions — anti N+1 via single JOIN (include)
app.get("/api/transactions", async (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const skip = (page - 1) * limit;
  const { status, type, customerId, employeeId } = req.query;

  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;
  if (customerId) where.customerId = Number(customerId);
  if (employeeId) where.employeeId = Number(employeeId);

  const [transactions, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        employee: { select: { id: true, name: true, email: true } },
        items: { include: { product: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);
  res.json({ data: transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }, where });
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

// Atomic SELL/BUY — stock guard + invoice retry
function genInvoiceNo() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `INV-${d}-${Math.floor(Math.random() * 900000 + 100000)}`;
}

app.post("/api/transactions", auth, async (req, res) => {
  const schema = z.object({
    customerId: z.number().int().positive().optional().nullable(),
    type: z.enum(["SELL", "BUY"]).default("SELL"),
    items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1) })).min(1),
    paidAmount: z.number().int().min(0),
    notes: z.string().optional().nullable(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { customerId, type, items, paidAmount, notes } = parsed.data;

  if (customerId) {
    const cust = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!cust) return res.status(404).json({ error: "customer not found" });
  }

  const ids = items.map((i) => i.productId);
  if (new Set(ids).size !== ids.length) return res.status(400).json({ error: "duplicate productId in items" });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const products = await tx.product.findMany({ where: { id: { in: ids } } });
          if (products.length !== ids.length) throw Object.assign(new Error("product not found"), { status: 404 });
          for (const p of products) {
            if (!p.isActive) throw Object.assign(new Error(`product inactive: ${p.name}`), { status: 400 });
          }

          let totalAmount = 0;
          let totalWeight = 0;
          const itemCreates = [];

          for (const it of items) {
            const p = products.find((x) => x.id === it.productId);
            if (type === "SELL" && p.stock < it.quantity) {
              throw Object.assign(new Error(`stok kurang: ${p.name} (stock=${p.stock}, minta=${it.quantity})`), { status: 400 });
            }
            const priceAtSale = p.price;
            const weightGrams = p.weightGrams;
            totalAmount += priceAtSale * it.quantity;
            totalWeight += Number(weightGrams) * it.quantity;
            itemCreates.push({ productId: p.id, quantity: it.quantity, weightGrams, priceAtSale, subtotal: priceAtSale * it.quantity });

            const upd =
              type === "SELL"
                ? await tx.product.updateMany({ where: { id: p.id, stock: { gte: it.quantity } }, data: { stock: { decrement: it.quantity } } })
                : await tx.product.updateMany({ where: { id: p.id }, data: { stock: { increment: it.quantity } } });
            if (upd.count !== 1) throw Object.assign(new Error(`gagal update stock ${p.name} — race condition`), { status: 409 });
          }

          return tx.transaction.create({
            data: {
              invoiceNo: genInvoiceNo(),
              type,
              status: "COMPLETED",
              customerId: customerId || null,
              employeeId: req.user.id,
              totalWeight,
              totalAmount,
              paidAmount,
              notes: notes || null,
              items: { create: itemCreates },
            },
            include: {
              customer: { select: { id: true, name: true, phone: true } },
              employee: { select: { id: true, name: true, email: true } },
              items: { include: { product: true } },
            },
          });
        },
        { maxWait: 5000, timeout: 10000 },
      );
      return res.status(201).json(result);
    } catch (e) {
      if (e.code === "P2002" && e.meta?.target?.includes("invoice_no")) {
        if (attempt < 2) continue;
        return res.status(409).json({ error: "invoice collision, please retry" });
      }
      if (e.code === "P2034") {
        if (attempt < 2) continue;
        return res.status(503).json({ error: "transaction timeout, please retry" });
      }
      if (e.status) return res.status(e.status).json({ error: e.message });
      throw e;
    }
  }
});

// Atomic cancel — revert stock
app.post("/api/transactions/:id/cancel", auth, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "invalid id" });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const trx = await tx.transaction.findUnique({ where: { id }, include: { items: true } });
      if (!trx) throw Object.assign(new Error("transaction not found"), { status: 404 });
      if (trx.status === "CANCELLED") throw Object.assign(new Error("already cancelled"), { status: 400 });
      for (const it of trx.items) {
        if (trx.type === "SELL") {
          await tx.product.updateMany({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } });
        } else {
          const upd = await tx.product.updateMany({
            where: { id: it.productId, stock: { gte: it.quantity } },
            data: { stock: { decrement: it.quantity } },
          });
          if (upd.count !== 1) throw Object.assign(new Error(`stok tidak cukup untuk cancel buyback product ${it.productId}`), { status: 409 });
        }
      }
      return tx.transaction.update({ where: { id }, data: { status: "CANCELLED" }, include: { items: { include: { product: true } } } });
    });
    res.json(result);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.message });
    throw e;
  }
});

// ── Start & Shutdown ──
app.listen(PORT, () => console.log("ok :" + PORT));
process.on("SIGINT", async () => { await prisma.$disconnect(); process.exit(0); });
process.on("SIGTERM", async () => { await prisma.$disconnect(); process.exit(0); });
