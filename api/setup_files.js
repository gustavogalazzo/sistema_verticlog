// api/setup_files.js
const pool = require('./src/database/db')

async function addFileColumns() {
  try {
    // Adiciona coluna para o arquivo da conta (PDF/Foto do boleto)
    await pool.query(
      'ALTER TABLE bills ADD COLUMN IF NOT EXISTS bill_file TEXT'
    )

    // Adiciona coluna para o comprovante de pagamento
    await pool.query(
      'ALTER TABLE bills ADD COLUMN IF NOT EXISTS proof_file TEXT'
    )

    console.log('✅ Colunas de arquivos criadas com sucesso!')
  } catch (error) {
    console.error('Erro (pode ser que já existam):', error.message)
  } finally {
    pool.end()
  }
}

addFileColumns()
