require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const prisma = new PrismaClient();

async function seedEmployees() {
  console.log("Seeding employees...");
  const data = [
    {
      name: "Admin",
      email: "admin@jualemas.test",
      password: "admin123",
      role: "admin",
      salary: 10000000,
    },
    {
      name: "Kasir 1",
      email: "kasir1@jualemas.test",
      password: "kasir123",
      role: "kasir",
      salary: 5000000,
    },
    {
      name: "Kasir 2",
      email: "kasir2@jualemas.test",
      password: "kasir123",
      role: "kasir",
      salary: 5000000,
    },
    {
      name: "Manager Toko",
      email: "manager@jualemas.test",
      password: "manager123",
      role: "manager",
      salary: 8000000,
    },
    {
      name: "Staff Gudang 1",
      email: "gudang1@jualemas.test",
      password: "gudang123",
      role: "gudang",
      salary: 4500000,
    },
    {
      name: "Staff Gudang 2",
      email: "gudang2@jualemas.test",
      password: "gudang123",
      role: "gudang",
      salary: 4500000,
    },
    {
      name: "Marketing",
      email: "marketing@jualemas.test",
      password: "marketing123",
      role: "marketing",
      salary: 6000000,
    },
    {
      name: "Customer Service 1",
      email: "cs1@jualemas.test",
      password: "cs12345",
      role: "cs",
      salary: 4800000,
    },
    {
      name: "Customer Service 2",
      email: "cs2@jualemas.test",
      password: "cs12345",
      role: "cs",
      salary: 4800000,
    },
    {
      name: "Owner",
      email: "owner@jualemas.test",
      password: "owner123",
      role: "owner",
      salary: 15000000,
    },
  ];
  for (const e of data) {
    const hash = await bcrypt.hash(e.password, 10);
    const emp = await prisma.employee.upsert({
      where: { email: e.email },
      update: { name: e.name, role: e.role, salary: e.salary },
      create: {
        name: e.name,
        email: e.email,
        password: hash,
        role: e.role,
        salary: e.salary,
      },
    });
    console.log(`  upserted employee ${emp.email} id=${emp.id}`);
  }
  console.log(`  employees: ${await prisma.employee.count()}`);
}

async function seedProducts() {
  console.log("Seeding products... (8 products)");
  const products = [
    {
      sku: "LM-ANTAM-1GR",
      name: "Logam Mulia Antam 1 Gram",
      category: "logam_mulia",
      karat: 24,
      weightGrams: 1,
      purity: 99.99,
      price: 1450000,
      stock: 50,
    },
    {
      sku: "LM-ANTAM-5GR",
      name: "Logam Mulia Antam 5 Gram",
      category: "logam_mulia",
      karat: 24,
      weightGrams: 5,
      purity: 99.99,
      price: 7100000,
      stock: 30,
    },
    {
      sku: "LM-ANTAM-10GR",
      name: "Logam Mulia Antam 10 Gram",
      category: "logam_mulia",
      karat: 24,
      weightGrams: 10,
      purity: 99.99,
      price: 14100000,
      stock: 20,
    },
    {
      sku: "LM-UBS-1GR",
      name: "Logam Mulia UBS 1 Gram",
      category: "logam_mulia",
      karat: 24,
      weightGrams: 1,
      purity: 99.9,
      price: 1420000,
      stock: 40,
    },
    {
      sku: "PH-CINCIN-3GR",
      name: "Cincin Emas 3 Gram",
      category: "perhiasan",
      karat: 22,
      weightGrams: 3,
      purity: 91.6,
      price: 3800000,
      stock: 25,
    },
    {
      sku: "PH-KALUNG-5GR",
      name: "Kalung Emas 5 Gram",
      category: "perhiasan",
      karat: 22,
      weightGrams: 5,
      purity: 91.6,
      price: 6200000,
      stock: 20,
    },
    {
      sku: "PH-GELANG-10GR",
      name: "Gelang Emas 10 Gram",
      category: "perhiasan",
      karat: 18,
      weightGrams: 10,
      purity: 75.0,
      price: 10500000,
      stock: 12,
    },
    {
      sku: "KOIN-DINAR-4.25GR",
      name: "Koin Dinar 4.25 Gram",
      category: "koin",
      karat: 22,
      weightGrams: 4.25,
      purity: 91.7,
      price: 5200000,
      stock: 30,
    },
  ];
  // keep exactly 8: remove extra SKUs that exceed 8 if present in future runs
  const targetSkus = products.map((p) => p.sku);
  for (const p of products) {
    const prod = await prisma.product.upsert({
      where: { sku: p.sku },
      update: {
        name: p.name,
        price: p.price,
        stock: p.stock,
        category: p.category,
        karat: p.karat,
        weightGrams: p.weightGrams,
        purity: p.purity,
        isActive: true,
      },
      create: p,
    });
    console.log(`  upserted product ${prod.sku} id=${prod.id}`);
  }
  // cleanup stale products outside the 8-list (handle FK: delete dependent items/transactions first)
  const stale = await prisma.product.findMany({
    where: { sku: { notIn: targetSkus } },
    select: { id: true, sku: true },
  });
  if (stale.length) {
    const staleIds = stale.map((s) => s.id);
    console.log(
      `  found ${stale.length} stale products: ${stale.map((s) => s.sku).join(", ")} — cleaning dependents...`,
    );
    // must delete child transaction_items before product (RESTRICT)
    const delItems = await prisma.transactionItem.deleteMany({
      where: { productId: { in: staleIds } },
    });
    if (delItems.count)
      console.log(
        `  deleted ${delItems.count} transaction_items referencing stale products`,
      );
    // delete parent transactions that became empty
    const delEmptyTx = await prisma.transaction.deleteMany({
      where: { items: { none: {} } },
    });
    if (delEmptyTx.count)
      console.log(`  deleted ${delEmptyTx.count} empty transactions`);
    const deleted = await prisma.product.deleteMany({
      where: { id: { in: staleIds } },
    });
    if (deleted.count) console.log(`  deleted ${deleted.count} stale products`);
  }
  console.log(`  products: ${await prisma.product.count()}`);
}

async function seedCustomers() {
  console.log("Seeding customers... (10 customers)");
  const customers = [
    {
      name: "Budi Santoso",
      phone: "081111111111",
      email: "budi@test.com",
      nik: "3201011111111111",
      address: "Jl. Merdeka No.1 Jakarta",
    },
    {
      name: "Siti Aminah",
      phone: "081222222222",
      email: "siti@test.com",
      nik: "3201022222222222",
      address: "Jl. Sudirman No.10 Bandung",
    },
    {
      name: "Andi Wijaya",
      phone: "081333333333",
      email: "andi@test.com",
      nik: "3201033333333333",
      address: "Jl. Thamrin No.5 Surabaya",
    },
    {
      name: "Rina Marlina",
      phone: "081444444444",
      email: null,
      nik: null,
      address: "Jl. Gatot Subroto No.8 Medan",
    },
    {
      name: "Hendra Gunawan",
      phone: "081555555555",
      email: "hendra@test.com",
      nik: "3201055555555555",
      address: "Jl. Pahlawan No.20 Semarang",
    },
    {
      name: "Dewi Lestari",
      phone: "081666666666",
      email: "dewi@test.com",
      nik: "3201066666666666",
      address: "Jl. Asia Afrika No.15 Bandung",
    },
    {
      name: "Eko Prasetyo",
      phone: "081777777777",
      email: "eko@test.com",
      nik: "3201077777777777",
      address: "Jl. Malioboro No.33 Yogyakarta",
    },
    {
      name: "Fitri Handayani",
      phone: "081888888888",
      email: "fitri@test.com",
      nik: null,
      address: "Jl. Diponegoro No.7 Medan",
    },
    {
      name: "Joko Susilo",
      phone: "081999999999",
      email: "joko@test.com",
      nik: "3201099999999999",
      address: "Jl. Pemuda No.12 Surabaya",
    },
    {
      name: "Maya Sari",
      phone: "082000000000",
      email: "maya@test.com",
      nik: "3201000000000000",
      address: "Jl. Kebon Jeruk No.88 Jakarta Barat",
    },
  ];
  for (const c of customers) {
    const cust = await prisma.customer.upsert({
      where: { phone: c.phone },
      update: { name: c.name, email: c.email, nik: c.nik, address: c.address },
      create: c,
    });
    console.log(`  upserted customer ${cust.phone} id=${cust.id}`);
  }
  console.log(`  customers: ${await prisma.customer.count()}`);
}

async function seedTransactions() {
  console.log("Seeding transactions...");
  const employees = await prisma.employee.findMany({ select: { id: true } });
  const customers = await prisma.customer.findMany({ select: { id: true } });
  const products = await prisma.product.findMany();
  if (!products.length || !employees.length || !customers.length)
    throw new Error("seed products/customers/employees first");

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let seq = (await prisma.transaction.count()) + 1;

  const txTemplates = [
    { type: "SELL", items: ["LM-ANTAM-1GR", "LM-ANTAM-5GR"] },
    { type: "SELL", items: ["PH-CINCIN-3GR"] },
    {
      type: "SELL",
      items: ["LM-ANTAM-10GR", "KOIN-DINAR-4.25GR", "PH-KALUNG-5GR"],
    },
    { type: "BUY", items: ["LM-ANTAM-1GR"] },
    { type: "SELL", items: ["LM-UBS-1GR", "PH-CINCIN-3GR"] },
    { type: "SELL", items: ["PH-GELANG-10GR"] },
    { type: "SELL", items: ["LM-ANTAM-10GR"] },
    { type: "SELL", items: ["KOIN-DINAR-4.25GR", "KOIN-DINAR-4.25GR"] },
  ];

  for (let i = 0; i < txTemplates.length; i++) {
    const t = txTemplates[i];
    const invoiceNo = `INV-${today}-${String(seq++).padStart(4, "0")}`;
    const exists = await prisma.transaction.findUnique({
      where: { invoiceNo },
    });
    if (exists) {
      console.log(`  skip exists ${invoiceNo}`);
      continue;
    }
    const employeeId = employees[i % employees.length].id;
    const customerId = customers[i % customers.length].id;

    const qtyMap = {};
    for (const sku of t.items) qtyMap[sku] = (qtyMap[sku] || 0) + 1;

    let totalWeight = 0;
    let totalAmount = 0;
    const createItems = [];
    for (const [sku, qty] of Object.entries(qtyMap)) {
      const prod = products.find((p) => p.sku === sku);
      if (!prod) throw new Error(`product not found ${sku}`);
      const subtotal = prod.price * qty;
      const weight = Number(prod.weightGrams) * qty;
      totalWeight += weight;
      totalAmount += subtotal;
      createItems.push({
        productId: prod.id,
        quantity: qty,
        weightGrams: weight,
        priceAtSale: prod.price,
        subtotal,
      });
    }

    const tx = await prisma.transaction.create({
      data: {
        invoiceNo,
        type: t.type,
        status: "COMPLETED",
        employeeId,
        customerId,
        totalWeight,
        totalAmount,
        paidAmount: totalAmount,
        notes: `Seed ${t.type} #${i + 1}`,
        items: { create: createItems },
      },
      include: { items: true },
    });
    console.log(
      `  created ${tx.invoiceNo} (${tx.type}) total=${tx.totalAmount} items=${tx.items.length}`,
    );
  }
  console.log(
    `  transactions: ${await prisma.transaction.count()}, items: ${await prisma.transactionItem.count()}`,
  );
}

async function main() {
  await seedEmployees();
  await seedProducts();
  await seedCustomers();
  await seedTransactions();
  console.log("Seed done.");
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
