// api/src/routes.js
const express = require('express')
const router = express.Router()
const pool = require('./database/db')
const bcrypt = require('bcryptjs')

// === ROTA 1: CADASTRAR USUÁRIO ===
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body

    // Verifica se já existe
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [
      email
    ])
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Erro: Usuário já existe!' })
    }

    // Criptografa a senha
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Salva
    const newUser = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email, hashedPassword, role || 'user']
    )

    res.json({
      message: 'Usuário cadastrado com sucesso!',
      user: newUser.rows[0]
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro no servidor ao cadastrar' })
  }
})

// === ROTA: EDITAR USUÁRIO ===
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, role } = req.body

    // Atualiza apenas nome, email e cargo (não mexemos na senha aqui por segurança)
    await pool.query(
      'UPDATE users SET name = $1, email = $2, role = $3 WHERE id = $4',
      [name, email, role, id]
    )

    res.json({ message: 'Usuário atualizado com sucesso!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao atualizar usuário' })
  }
})

// === ROTA 2: LOGIN ===
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Email ou senha incorretos!' })
    }

    const user = userResult.rows[0]
    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      return res.status(400).json({ message: 'Email ou senha incorretos!' })
    }

    res.json({
      message: 'Login realizado!',
      user: { id: user.id, name: user.name, role: user.role }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro no servidor ao logar' })
  }
})

// === ROTA 3: CADASTRAR CONTA (COM ARQUIVO) ===
router.post('/bills', async (req, res) => {
  try {
    const { description, amount, due_date, user_id, bill_file } = req.body

    const newBill = await pool.query(
      'INSERT INTO bills (description, amount, due_date, user_id, status, bill_file) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [description, amount, due_date, user_id, 'pendente', bill_file]
    )

    res.json(newBill.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao salvar conta' })
  }
})

// === ROTA 4: LISTAR CONTAS (Com regra de Chefe vs Funcionário) ===
router.get('/bills', async (req, res) => {
  try {
    const { userId, userRole } = req.query
    let query
    let params = []

    if (userRole === 'admin') {
      // ADMIN: Vê tudo + nome de quem cadastrou
      query = `
                SELECT bills.*, users.name as user_name 
                FROM bills 
                JOIN users ON bills.user_id = users.id 
                ORDER BY due_date ASC
            `
    } else {
      // COMUM: Vê só as suas
      query = `
                SELECT bills.*, users.name as user_name 
                FROM bills 
                JOIN users ON bills.user_id = users.id 
                WHERE bills.user_id = $1
                ORDER BY due_date ASC
            `
      params = [userId]
    }

    const allBills = await pool.query(query, params)
    res.json(allBills.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar contas' })
  }
})

// === ROTA 5: ATUALIZAR CONTA (Inteligente) ===
router.put('/bills/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { description, amount, due_date, status, bill_file, proof_file } =
      req.body

    // 1. LÓGICA DE DADOS PRINCIPAIS
    if (description) {
      // Se veio descrição, é uma EDIÇÃO COMPLETA (veio do botão lápis)
      await pool.query(
        'UPDATE bills SET description = $1, amount = $2, due_date = $3, status = $4 WHERE id = $5',
        [description, amount, due_date, status, id]
      )
    } else if (status) {
      // Se NÃO veio descrição, mas veio status, é apenas uma BAIXA (veio do botão pagar)
      await pool.query('UPDATE bills SET status = $1 WHERE id = $2', [
        status,
        id
      ])
    }

    // 2. LÓGICA DE ARQUIVOS (Funciona para ambos os casos)

    // Arquivo da Conta (Boleto)
    if (bill_file === 'REMOVE') {
      await pool.query('UPDATE bills SET bill_file = NULL WHERE id = $1', [id])
    } else if (bill_file) {
      await pool.query('UPDATE bills SET bill_file = $1 WHERE id = $2', [
        bill_file,
        id
      ])
    }

    // Arquivo do Comprovante (Recibo)
    if (proof_file === 'REMOVE') {
      await pool.query('UPDATE bills SET proof_file = NULL WHERE id = $1', [id])
    } else if (proof_file) {
      await pool.query('UPDATE bills SET proof_file = $1 WHERE id = $2', [
        proof_file,
        id
      ])
    }

    res.json({ message: 'Conta atualizada com sucesso!' })
  } catch (err) {
    console.error('Erro ao atualizar:', err.message)
    res.status(500).json({ message: 'Erro ao atualizar conta' })
  }
})
// === ROTA 6: EXCLUIR CONTA ===
router.delete('/bills/:id', async (req, res) => {
  try {
    const { id } = req.params

    await pool.query('DELETE FROM bills WHERE id = $1', [id])

    res.json({ message: 'Conta excluída com sucesso!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao excluir conta' })
  }
})

// === ROTA 7: LISTAR TODOS OS USUÁRIOS (Apenas nome, email e cargo) ===
router.get('/users', async (req, res) => {
  try {
    // Não devolvemos a senha por segurança
    const users = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY id ASC'
    )
    res.json(users.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar usuários' })
  }
})

// === ROTA 8: EXCLUIR USUÁRIO ===
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Impede que o usuário se exclua a si mesmo (opcional, mas recomendado)
    // Isso exigiria verificar o token, mas por enquanto vamos confiar no frontend

    await pool.query('DELETE FROM users WHERE id = $1', [id])
    res.json({ message: 'Usuário excluído com sucesso!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao excluir usuário' })
  }
})

// ============================================
// MÓDULO DE ESTOQUE (INVENTORY)
// ============================================

// 9. LISTAR ESTOQUE
router.get('/inventory', async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM inventory ORDER BY name ASC')
    res.json(items.rows)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar estoque' })
  }
})

// 10. ADICIONAR ITEM AO ESTOQUE
router.post('/inventory', async (req, res) => {
  try {
    const { name, category, quantity, price } = req.body

    await pool.query(
      'INSERT INTO inventory (name, category, quantity, price) VALUES ($1, $2, $3, $4)',
      [name, category, quantity, price]
    )

    res.json({ message: 'Item adicionado!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao adicionar item' })
  }
})

// 11. EXCLUIR ITEM
router.delete('/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM inventory WHERE id = $1', [id])
    res.json({ message: 'Item removido!' })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao remover item' })
  }
})

module.exports = router
