const express = require('express')
const router = express.Router()
const pool = require('./database/db')
const bcrypt = require('bcryptjs')

// ============================================
// 1. MÓDULO DE USUÁRIOS & AUTENTICAÇÃO
// ============================================

// ROTA 1: CADASTRAR USUÁRIO
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

// ROTA 2: LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )

    if (userResult.rows.length === 0)
      return res.status(400).json({ message: 'Email ou senha incorretos!' })

    const user = userResult.rows[0]
    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword)
      return res.status(400).json({ message: 'Email ou senha incorretos!' })

    res.json({
      message: 'Login realizado!',
      user: { id: user.id, name: user.name, role: user.role }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro no servidor ao logar' })
  }
})

// ROTA: LISTAR USUÁRIOS (ADMIN)
router.get('/users', async (req, res) => {
  try {
    const users = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY id ASC'
    )
    res.json(users.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar usuários' })
  }
})

// ROTA: EDITAR USUÁRIO
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, email, role } = req.body
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

// ROTA: EXCLUIR USUÁRIO
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM users WHERE id = $1', [id])
    res.json({ message: 'Usuário excluído com sucesso!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao excluir usuário' })
  }
})

// ============================================
// 2. MÓDULO FINANCEIRO (CONTAS)
// ============================================

// ROTA 3: CADASTRAR CONTA (COM REPETIÇÃO E TIPO)
router.post('/bills', async (req, res) => {
  try {
    const {
      description,
      amount,
      due_date,
      user_id,
      bill_file,
      repeat_months,
      type
    } = req.body

    // Padrão: Despesa se não vier tipo
    const tipoLancamento = type || 'expense'
    const totalLancamentos = repeat_months ? parseInt(repeat_months) : 1

    // Decompor data para evitar bug de fuso horário
    let [ano, mes, dia] = due_date.split('-').map(Number)

    for (let i = 0; i < totalLancamentos; i++) {
      let dataString = due_date

      // Se for repetição, calcula o próximo mês
      if (i > 0) {
        mes++
        if (mes > 12) {
          mes = 1
          ano++
        }
        // Formata YYYY-MM-DD
        dataString = `${ano}-${mes.toString().padStart(2, '0')}-${dia
          .toString()
          .padStart(2, '0')}`
      }

      let descFinal = description
      if (totalLancamentos > 1) {
        descFinal = `${description} (${i + 1}/${totalLancamentos})`
      }

      await pool.query(
        'INSERT INTO bills (description, amount, due_date, user_id, status, bill_file, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          descFinal,
          amount,
          dataString,
          user_id,
          'pendente',
          bill_file,
          tipoLancamento
        ]
      )
    }

    res.json({ message: 'Lançamento(s) salvo(s) com sucesso!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao salvar conta' })
  }
})

// ROTA 4: LISTAR CONTAS (ORDEM: ÚLTIMOS CADASTRADOS PRIMEIRO)
router.get('/bills', async (req, res) => {
  try {
    const { userId, userRole, type } = req.query
    let query = `
            SELECT b.*, u.name as user_name 
            FROM bills b 
            JOIN users u ON b.user_id = u.id 
            WHERE 1=1
        `
    const params = []

    if (userRole !== 'admin') {
      params.push(userId)
      query += ` AND b.user_id = $${params.length}`
    }

    if (type && type !== 'todos') {
      params.push(type)
      query += ` AND b.type = $${params.length}`
    }

    // MUDANÇA AQUI: Ordenar pelo ID Decrescente (Mais novo no topo)
    query += ' ORDER BY b.id DESC'

    const allBills = await pool.query(query, params)
    res.json(allBills.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao buscar contas' })
  }
})

// ROTA 5: ATUALIZAR CONTA (COM REPETIÇÃO)
router.put('/bills/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      description,
      amount,
      due_date,
      status,
      bill_file,
      proof_file,
      type,
      repeat_months
    } = req.body

    // 1. Atualiza dados básicos
    if (description) {
      await pool.query(
        'UPDATE bills SET description=$1, amount=$2, due_date=$3, status=$4, type=$5 WHERE id=$6',
        [description, amount, due_date, status, type, id]
      )
    } else if (status) {
      // Apenas mudando status (ex: Pagar)
      await pool.query('UPDATE bills SET status=$1 WHERE id=$2', [status, id])
    }

    // 2. Atualiza Arquivos
    if (bill_file === 'REMOVE')
      await pool.query('UPDATE bills SET bill_file=NULL WHERE id=$1', [id])
    else if (bill_file)
      await pool.query('UPDATE bills SET bill_file=$1 WHERE id=$2', [
        bill_file,
        id
      ])

    if (proof_file === 'REMOVE')
      await pool.query('UPDATE bills SET proof_file=NULL WHERE id=$1', [id])
    else if (proof_file)
      await pool.query('UPDATE bills SET proof_file=$1 WHERE id=$2', [
        proof_file,
        id
      ])

    // 3. Gerar Recorrência na Edição (Se solicitado)
    if (repeat_months && parseInt(repeat_months) > 0 && description) {
      const total = parseInt(repeat_months)
      const userRes = await pool.query(
        'SELECT user_id FROM bills WHERE id = $1',
        [id]
      )
      const userId = userRes.rows[0].user_id

      let [a, m, d] = due_date.split('-').map(Number)

      for (let i = 1; i <= total; i++) {
        m++
        if (m > 12) {
          m = 1
          a++
        }
        const novaData = `${a}-${m.toString().padStart(2, '0')}-${d
          .toString()
          .padStart(2, '0')}`
        const novaDesc = `${description} (Repetição ${i})`

        await pool.query(
          'INSERT INTO bills (description, amount, due_date, user_id, status, bill_file, type) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [
            novaDesc,
            amount,
            novaData,
            userId,
            'pendente',
            bill_file || null,
            type || 'expense'
          ]
        )
      }
    }

    res.json({ message: 'Conta atualizada com sucesso!' })
  } catch (err) {
    console.error('Erro ao atualizar:', err.message)
    res.status(500).json({ message: 'Erro ao atualizar conta' })
  }
})

// ROTA 6: EXCLUIR CONTA
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

// ============================================
// 3. MÓDULO DE ESTOQUE (INVENTORY)
// ============================================

// ROTA 9: LISTAR ESTOQUE (COM ALERTA)
router.get('/inventory', async (req, res) => {
  try {
    const items = await pool.query('SELECT * FROM inventory ORDER BY name ASC')

    // Processa para adicionar flag de alerta (is_low)
    const itemsProcessados = items.rows.map(item => ({
      ...item,
      // Se min_quantity for null, usa 5 como padrão
      is_low: item.quantity <= (item.min_quantity || 5)
    }))

    res.json(itemsProcessados)
  } catch (err) {
    res.status(500).json({ message: 'Erro ao buscar estoque' })
  }
})

// ROTA 10: ADICIONAR ITEM AO ESTOQUE
router.post('/inventory', async (req, res) => {
  try {
    const { name, category, quantity, price, min_quantity } = req.body

    await pool.query(
      'INSERT INTO inventory (name, category, quantity, price, min_quantity) VALUES ($1, $2, $3, $4, $5)',
      [name, category, quantity, price, min_quantity || 5]
    )

    res.json({ message: 'Item adicionado!' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao adicionar item' })
  }
})

// ROTA 11: EXCLUIR ITEM
router.delete('/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params
    await pool.query('DELETE FROM inventory WHERE id = $1', [id])
    res.json({ message: 'Item removido!' })
  } catch (err) {
    res.status(500).json({ message: 'Erro ao remover item' })
  }
})

// ============================================
// 4. MÓDULO DE SISTEMA (BACKUP)
// ============================================

// ROTA: BACKUP COMPLETO
router.get('/backup', async (req, res) => {
  try {
    // Busca tudo
    const users = await pool.query('SELECT * FROM users')
    const bills = await pool.query('SELECT * FROM bills')
    const inventory = await pool.query('SELECT * FROM inventory')

    const backupData = {
      date: new Date(),
      users: users.rows,
      bills: bills.rows,
      inventory: inventory.rows
    }

    // Força download do arquivo JSON
    res.setHeader('Content-Type', 'application/json')
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=backup_verticlog.json'
    )
    res.json(backupData)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Erro ao gerar backup' })
  }
})

module.exports = router
