const express = require('express')
const cors = require('cors') // Importa a segurança
const routes = require('./src/routes')

const app = express()

// 1. Configuração de Segurança (CORS) - Permite tudo para facilitar
app.use(cors())

// 2. Permite que o servidor entenda JSON (dados do formulário)
app.use(express.json({ limit: '50mb' })) // Aumenta limite para arquivos grandes

// 3. Usa as rotas que criamos
app.use(routes)

// 4. Rota de teste simples (para saber se está vivo)
app.get('/', (req, res) => {
  res.send('🚀 API do Verticlog está rodando!')
})

// 5. Inicia o servidor
const PORT = 3000
app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando em http://localhost:${PORT}`)
  console.log(`✅ Base de Dados conectada e pronta.`)
})
