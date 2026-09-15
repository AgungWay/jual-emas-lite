# jual-emas-lite

Aplikasi jual/beli emas — backend native **Express + Prisma + PostgreSQL** (tanpa Docker).

## Prasyarat

- Node.js 18+
- PostgreSQL 14+ berjalan lokal
- Database kosong `jual_emas_lite` sudah dibuat:
  ```sql
  CREATE DATABASE jual_emas_lite;
  ```

## 3 Langkah Native

### 1) Install

```powershell
cd backend
npm install
```

### 2) Konfigurasi DB + Migrate + Seed

Buat file `backend/.env`:

```env
PORT=3000
DATABASE_URL=postgres://postgres:admin@localhost:5432/jual_emas_lite
JWT_SECRET=supersecret123
```

Jalankan migrate & seed:

```powershell
npx prisma migrate deploy
npm run prisma:seed
```

### 3) Jalankan

```powershell
npm run dev
# atau
npm start
```

Cek health:

```powershell
Invoke-RestMethod http://localhost:3000/health
# -> { status: ok }
```

## Verifikasi Cepat

```powershell
# 1. Login (public, dapat token)
$login = Invoke-RestMethod http://localhost:3000/api/auth/login -Method POST -ContentType "application/json" -Body '{"email":"admin@jualemas.test","password":"admin123"}'
$token = $login.token

# 2. Akses endpoint protected
Invoke-RestMethod http://localhost:3000/api/employees -Headers @{ Authorization = "Bearer $token" }

# 3. Transaksi atomik SELL (guarded stock, anti-oversell)
Invoke-RestMethod http://localhost:3000/api/transactions -Method POST -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body '{"type":"SELL","items":[{"productId":1,"quantity":1}],"paidAmount":1450000}'
```

> cURL alternatif:
>
> ```bash
> curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@jualemas.test","password":"admin123"}'
> curl http://localhost:3000/api/employees -H "Authorization: Bearer <token>"
> ```

## Endpoint

| Method     | Path                                         | Auth   |
| ---------- | -------------------------------------------- | ------ |
| GET        | `/health`                                    | -      |
| POST       | `/api/auth`, `/api/auth/login`               | -      |
| GET / POST | `/api/employees`                             | Bearer |
| GET        | `/api/products`, `/api/products/:id`         | -      |
| GET        | `/api/customers`, `/api/customers/:id`       | -      |
| GET        | `/api/transactions`, `/api/transactions/:id` | -      |
| POST       | `/api/transactions`                          | Bearer |
| POST       | `/api/transactions/:id/cancel`               | Bearer |

## Scripts

| Command               | Fungsi                                                      |
| --------------------- | ----------------------------------------------------------- |
| `npm run dev`         | nodemon (auto-reload)                                       |
| `npm start`           | production                                                  |
| `npm run watch`       | node --watch                                                |
| `npm run prisma:seed` | seed 10 employees / 8+ products / 10+ customers / transaksi |
| `npx prisma studio`   | GUI database                                                |
