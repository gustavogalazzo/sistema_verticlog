// api/server.js
const express = require('express')
const cors = require('cors')
const pool = require('./src/database/db')
const routes = require('./src/routes')
require('dotenv').config()

const app = express()

app.use(cors())
// Aumenta o limite para aceitar arquivos (PDFs/Imagens) até 10MB
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Avisamos o servidor para usar as rotas que criamos
app.use(routes)

// Teste de conexão visual
pool
  .query('SELECT NOW()')
  .then(() => console.log('✅ Base de Dados conectada!'))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em: http://localhost:${PORT}`)
})
