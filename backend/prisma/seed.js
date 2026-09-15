require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding employees...");

  const seedData = [
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

  for (const e of seedData) {
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
    console.log(`  upserted: ${emp.email} (id=${emp.id})`);
  }

  const count = await prisma.employee.count();
  console.log(`Seed done. Total employees: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
