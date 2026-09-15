require('dotenv').config()
const { z } = require('zod');
const express = require('express')
const { Pool } = require('pg')
const bcrypt = require('bcrypt')
const app = express()
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
app.use(express.json())
app.get('/health', (req,res) => res.json({status:'ok'}))
app.get('/api/employees', async (req,res) => {
  const {rows} = await pool.query('SELECT id,name,email FROM employees ORDER BY id')
  res.json(rows)
})
app.post('/api/employees', async (req,res) => {
  const schema=z.object({name:z.string().min(2), email:z.string().email(), password:z.string().min(6)})
  try{ schema.parse(req.body) }catch(e){ return res.status(400).json({error:e.errors ?? e.issues}) }
  const {name,email,password}=req.body
  const hash=await bcrypt.hash(password, 10)
  const {rows}=await pool.query("INSERT INTO employees(name,email,password) VALUES($1,$2,$3) RETURNING id,name,email",[name,email,hash])
  res.status(201).json(rows[0])
})
app.listen(process.env.PORT, () => console.log('ok :'+process.env.PORT))