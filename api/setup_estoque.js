// api/setup_estoque.js
const pool = require('./src/database/db')

async function createInventoryTable() {
  const query = `
        CREATE TABLE IF NOT EXISTS inventory (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,          -- Nome (Ex: Viga 2.30m)
            category VARCHAR(100),               -- Categoria (Ex: Aço, Parafusos)
            quantity INTEGER DEFAULT 0,          -- Quantidade
            price DECIMAL(10, 2) DEFAULT 0.00,   -- Preço Unitário
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `

  try {
    await pool.query(query)
    console.log('✅ Tabela "inventory" (Estoque) criada com sucesso!')
  } catch (error) {
    console.error('Erro:', error)
  } finally {
    pool.end()
  }
}

createInventoryTable()
