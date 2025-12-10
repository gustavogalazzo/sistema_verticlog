// api/src/database/db.js
const { Pool } = require('pg')
require('dotenv').config() // Carrega as variáveis do .env

// Configura a conexão
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Obrigatório para o Render
  }
})

// Mensagem quando conectar
pool.on('connect', () => {
  console.log('✅ Base de Dados conectada com sucesso!')
})

module.exports = pool
