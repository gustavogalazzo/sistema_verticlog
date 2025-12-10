// web/js/dashboard.js

// ==========================================
// 0. VARIÁVEIS GLOBAIS E AUTENTICAÇÃO
// ==========================================

let calendar
let contasCache = []
let itensOrcamento = []
let listaProdutosCache = []
let dadosRelatorioCache = []

const usuarioLogado = JSON.parse(localStorage.getItem('usuarioVerticlog'))

if (!usuarioLogado) {
  alert('Você precisa fazer login!')
  window.location.href = '../index.html'
} else {
  const welcomeElement = document.getElementById('welcomeMsg')
  if (welcomeElement) welcomeElement.innerText = `Olá, ${usuarioLogado.name}`
  const roleDisplay = document.getElementById('userRoleDisplay')
  if (roleDisplay)
    roleDisplay.innerText =
      usuarioLogado.role === 'admin' ? 'Administrador' : 'Colaborador'
  const initDisplay = document.getElementById('userInitials')
  if (initDisplay)
    initDisplay.innerText = usuarioLogado.name.charAt(0).toUpperCase()
}

function logout() {
  localStorage.removeItem('usuarioVerticlog')
  window.location.href = '../index.html'
}

// ==========================================
// 1. FUNÇÕES UTILITÁRIAS (ARQUIVOS)
// ==========================================

const convertBase64 = file => {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader()
    fileReader.readAsDataURL(file)
    fileReader.onload = () => resolve(fileReader.result)
    fileReader.onerror = error => reject(error)
  })
}

function verArquivo(id, tipo) {
  const conta = contasCache.find(c => c.id === id)
  if (!conta) return alert('Erro ao encontrar arquivo.')

  const base64Data = tipo === 'conta' ? conta.bill_file : conta.proof_file
  if (!base64Data) return alert('Nenhum arquivo anexado.')

  fetch(base64Data)
    .then(res => res.blob())
    .then(blob => {
      const fileURL = URL.createObjectURL(blob)
      window.open(fileURL, '_blank')
    })
    .catch(err => {
      console.error(err)
      const win = window.open()
      win.document.write(
        '<iframe src="' +
          base64Data +
          '" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>'
      )
    })
}

// ==========================================
// 2. MÓDULO FINANCEIRO (CONTAS) - COM FILTRO
// ==========================================

// Função principal: Busca dados e chama o renderizador
async function carregarContas() {
  try {
    const url = `${API_URL}/bills?userId=${usuarioLogado.id}&userRole=${usuarioLogado.role}`
    const response = await fetch(url)
    const contas = await response.json()

    contasCache = contas // Guarda tudo na memória
    verificarVencimentosHoje(contas)
    renderizarTabelaContas(contasCache) // Desenha tudo inicialmente

    if (calendar) calendar.refetchEvents() // Atualiza calendário
  } catch (error) {
    console.error(error)
    document.getElementById('listaContas').innerHTML =
      '<tr><td colspan="6" style="color:red">Erro ao carregar.</td></tr>'
  }
}

// Função de Desenhar a Tabela (Recebe uma lista, filtrada ou não)
function renderizarTabelaContas(listaDeContas) {
  const listaElement = document.getElementById('listaContas')
  if (!listaElement) return

  listaElement.innerHTML = ''

  if (listaDeContas.length === 0) {
    listaElement.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:20px; color:#888;">Nenhuma conta encontrada com este filtro.</td></tr>'
    return
  }

  listaDeContas.forEach(conta => {
    const dataFormatada = new Date(conta.due_date).toLocaleDateString('pt-BR', {
      timeZone: 'UTC'
    })

    // --- 1. BOTÕES DE ARQUIVO (Limpos) ---
    let botoesArquivo = ''
    if (conta.bill_file) {
      botoesArquivo += `<button onclick="verArquivo(${conta.id}, 'conta')" class="file-btn" title="Ver Boleto">📄 Conta</button>`
    }
    if (conta.proof_file) {
      botoesArquivo += `<button onclick="verArquivo(${conta.id}, 'proof')" class="file-btn" title="Ver Recibo">🧾 Recibo</button>`
    }

    // --- 2. STATUS (Visual Bonito) ---
    let statusHtml = ''
    if (conta.status === 'pendente') {
      statusHtml =
        '<span style="background:#fff7ed; color:#c2410c; padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">● Pendente</span>'
    } else {
      statusHtml =
        '<span style="background:#f0fdf4; color:#15803d; padding:4px 8px; border-radius:12px; font-size:0.75rem; font-weight:bold;">● Pago</span>'
    }

    // --- 3. AÇÕES (Botões Ícones) ---
    let botoesAcao = ''

    // Botão Pagar (Só se pendente)
    if (conta.status === 'pendente') {
      botoesAcao += `<button onclick="abrirModalPagamento(${conta.id})" class="action-btn btn-pay" title="Dar Baixa/Pagar">✅</button>`
    } else {
      // Se já pagou, mostra um check cinza ou nada
      botoesAcao += `<span style="color:#cbd5e1; font-size:1.2rem; margin-right:8px;">✓</span>`
    }

    // Botão Editar (Lápis)
    const btnEditar = `<button onclick="abrirModalEditarConta('${conta.id}', '${conta.description}', '${conta.amount}', '${conta.due_date}', '${conta.status}')" class="action-btn btn-edit" title="Editar Lançamento">✏️</button>`

    // Botão Excluir (Lixeira)
    const btnExcluir = `<button onclick="excluirConta(${conta.id})" class="action-btn btn-delete" title="Excluir Definitivamente">🗑️</button>`

    // --- MONTAGEM DA LINHA ---

    // Descrição + Arquivos
    const descHTML = `
        <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-weight:600; color:#334155;">${conta.description}</span>
            <div style="display:flex;">${botoesArquivo}</div>
        </div>`

    listaElement.innerHTML += `
            <tr>
              <td>${descHTML}</td>
              <td style="font-weight:600;">R$ ${conta.amount}</td>
              <td>${dataFormatada}</td>
              <td style="color:#64748b; font-size:0.85rem;">${conta.user_name}</td>
              <td>${statusHtml}</td>
              <td>
                <div class="actions-cell">
                    ${botoesAcao}
                    ${btnEditar}
                    ${btnExcluir}
                </div>
              </td>
            </tr>
          `
  })
}

// Lógica do Filtro de Contas
function filtrarTabelaContas() {
  const inicio = document.getElementById('filtroContaInicio').value
  const fim = document.getElementById('filtroContaFim').value
  const status = document.getElementById('filtroContaStatus').value

  // Filtra o Cache
  const contasFiltradas = contasCache.filter(conta => {
    const dataConta = conta.due_date.split('T')[0] // YYYY-MM-DD

    // 1. Filtro de Data
    let dataOk = true
    if (inicio && dataConta < inicio) dataOk = false
    if (fim && dataConta > fim) dataOk = false

    // 2. Filtro de Status
    let statusOk = true
    if (status !== 'todos' && conta.status !== status) statusOk = false

    return dataOk && statusOk
  })

  renderizarTabelaContas(contasFiltradas)
}

function limparFiltrosContas() {
  document.getElementById('filtroContaInicio').value = ''
  document.getElementById('filtroContaFim').value = ''
  document.getElementById('filtroContaStatus').value = 'todos'
  renderizarTabelaContas(contasCache) // Restaura tudo
}

// ==========================================
// 3. MÓDULO DE EDIÇÃO COMPLETA
// ==========================================

function abrirModalEditarConta(id, desc, amount, date, status) {
  document.getElementById('editContaId').value = id
  document.getElementById('editContaDesc').value = desc
  document.getElementById('editContaValor').value = amount

  // Data
  const dataLimpa = date.split('T')[0]
  document.getElementById('editContaData').value = dataLimpa

  // Status
  document.getElementById('editContaStatus').value = status

  // Reseta campos de arquivo
  document.getElementById('editFileBill').value = ''
  document.getElementById('rmFileBill').checked = false
  document.getElementById('editFileProof').value = ''
  document.getElementById('rmFileProof').checked = false

  document.getElementById('modalEditarConta').style.display = 'flex'
}

async function salvarEdicaoConta() {
  const id = document.getElementById('editContaId').value
  const description = document.getElementById('editContaDesc').value
  const amount = document.getElementById('editContaValor').value
  const due_date = document.getElementById('editContaData').value
  const status = document.getElementById('editContaStatus').value

  // Arquivos
  const inputBill = document.getElementById('editFileBill')
  const rmBill = document.getElementById('rmFileBill').checked

  const inputProof = document.getElementById('editFileProof')
  const rmProof = document.getElementById('rmFileProof').checked

  if (!description || !amount || !due_date)
    return alert('Preencha os campos obrigatórios.')

  // Prepara objeto para enviar
  let payload = { description, amount, due_date, status }

  // Lógica de Arquivo de Conta
  if (rmBill) {
    payload.bill_file = 'REMOVE' // Sinal pro backend apagar
  } else if (inputBill.files.length > 0) {
    payload.bill_file = await convertBase64(inputBill.files[0])
  }

  // Lógica de Comprovante
  if (rmProof) {
    payload.proof_file = 'REMOVE'
  } else if (inputProof.files.length > 0) {
    payload.proof_file = await convertBase64(inputProof.files[0])
  }

  try {
    await fetch(`${API_URL}/bills/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    alert('Lançamento atualizado!')
    document.getElementById('modalEditarConta').style.display = 'none'
    carregarContas()
  } catch (error) {
    alert('Erro ao atualizar.')
  }
}

// ==========================================
// 4. CALENDÁRIO & DETALHES
// ==========================================

// === 4. INICIALIZA CALENDÁRIO (INTELIGENTE) ===
function iniciarCalendario() {
  var calendarEl = document.getElementById('calendar')
  if (!calendarEl) return

  // Detecta se é celular (tela menor que 768px)
  const isMobile = window.innerWidth < 768

  calendar = new FullCalendar.Calendar(calendarEl, {
    // Se for celular, usa Lista. Se for PC, usa Grade.
    initialView: isMobile ? 'listMonth' : 'dayGridMonth',
    locale: 'pt-br',
    height: 'auto', // Ajusta altura automaticamente
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: isMobile ? 'listMonth,listWeek' : 'dayGridMonth,listMonth'
    },

    // INTERATIVIDADE
    dateClick: function (info) {
      abrirDetalhesDoDia(info.dateStr)
    },
    eventClick: function (info) {
      const dataStr = info.event.start.toISOString().split('T')[0]
      abrirDetalhesDoDia(dataStr)
    },

    events: async function (info, successCallback, failureCallback) {
      if (contasCache.length > 0) {
        successCallback(mapearEventos(contasCache))
        return
      }
      const url = `${API_URL}/bills?userId=${usuarioLogado.id}&userRole=${usuarioLogado.role}`
      try {
        const response = await fetch(url)
        const contas = await response.json()
        contasCache = contas
        successCallback(mapearEventos(contas))
      } catch (error) {
        failureCallback(error)
      }
    }
  })
  calendar.render()
}

function mapearEventos(contas) {
  return contas.map(c => ({
    title: `R$ ${c.amount} - ${c.description} (${c.user_name})`,
    start: c.due_date.split('T')[0],
    color: c.status === 'pendente' ? '#e74c3c' : '#27ae60',
    extendedProps: { status: c.status }
  }))
}

// === FUNÇÃO PARA LISTAR CONTAS DO DIA CLICADO (COM BOTÃO PAGAR) ===
function abrirDetalhesDoDia(dataIso) {
  const dataObj = new Date(dataIso + 'T00:00:00')
  const dataBonita = dataObj.toLocaleDateString('pt-BR')
  document.getElementById(
    'tituloDetalhesDia'
  ).innerText = `📅 Contas de ${dataBonita}`

  const contasDoDia = contasCache.filter(
    c => c.due_date.split('T')[0] === dataIso
  )
  const divConteudo = document.getElementById('conteudoDetalhesDia')
  divConteudo.innerHTML = ''

  if (contasDoDia.length === 0) {
    divConteudo.innerHTML =
      '<p style="text-align:center; color:#666;">Nenhuma conta para este dia. 🏖️</p>'
  } else {
    let html = '<table style="width:100%; border-collapse:collapse;">'
    contasDoDia.forEach(c => {
      const corStatus = c.status === 'pago' ? 'green' : 'orange'
      const textoStatus = c.status === 'pago' ? 'Pago' : 'Pendente'

      // Botões de Arquivo
      let botoesArquivo = ''
      if (c.bill_file)
        botoesArquivo += `<button onclick="verArquivo(${c.id}, 'conta')" title="Ver Conta" style="border:1px solid #2980b9; background:#eaf6ff; color:#2980b9; cursor:pointer; font-size:0.7rem; padding:2px 5px; border-radius:4px; margin-right:5px;">📄</button>`
      if (c.proof_file)
        botoesArquivo += `<button onclick="verArquivo(${c.id}, 'proof')" title="Ver Recibo" style="border:1px solid #27ae60; background:#eaffea; color:#27ae60; cursor:pointer; font-size:0.7rem; padding:2px 5px; border-radius:4px;">🧾</button>`

      // Botão de PAGAR (Só aparece se for pendente)
      let btnPagar = ''
      if (c.status === 'pendente') {
        btnPagar = `<button onclick="irParaPagamentoDoCalendario(${c.id})" style="background:#27ae60; color:white; border:none; padding:4px 8px; border-radius:4px; font-size:0.7rem; cursor:pointer; margin-top:2px;">PAGAR ✅</button>`
      }

      html += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 0;">
                    <div style="font-weight:bold; margin-bottom:4px;">${c.description}</div>
                    <div style="display:flex; align-items:center;">${botoesArquivo}</div>
                    <small style="color:#999;">Por: ${c.user_name}</small>
                </td>
                <td style="text-align:right; vertical-align:top;">
                    <div style="font-size:1rem;">R$ ${c.amount}</div>
                    <div style="color:${corStatus}; font-size:0.7rem; font-weight:bold; text-transform:uppercase;">${textoStatus}</div>
                    ${btnPagar}
                </td>
            </tr>`
    })
    html += '</table>'
    divConteudo.innerHTML = html
  }
  document.getElementById('modalDetalhesDia').style.display = 'flex'
}

// Função auxiliar para o calendário
function irParaPagamentoDoCalendario(id) {
  document.getElementById('modalDetalhesDia').style.display = 'none' // Fecha o calendário
  abrirModalPagamento(id) // Abre o pagamento
}

// ==========================================
// 5. ADICIONAR CONTA / PAGAR / EXCLUIR
// ==========================================

const formConta = document.getElementById('formConta')
if (formConta) {
  formConta.addEventListener('submit', async e => {
    e.preventDefault()
    const description = document.getElementById('desc').value
    const amount = document.getElementById('amount').value
    const due_date = document.getElementById('date').value
    const fileInput = document.getElementById('fileBill')

    let bill_file = null
    if (fileInput && fileInput.files.length > 0) {
      if (fileInput.files[0].size > 5 * 1024 * 1024)
        return alert('Arquivo muito grande (Máx 5MB)')
      bill_file = await convertBase64(fileInput.files[0])
    }

    if (!description || !amount || !due_date)
      return alert('Preencha os campos.')

    try {
      await fetch(`${API_URL}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount,
          due_date,
          user_id: usuarioLogado.id,
          bill_file
        })
      })
      alert('Salvo!')
      document.getElementById('formConta').reset()
      if (fileInput) fileInput.value = ''
      carregarContas()
    } catch (error) {
      alert('Erro ao salvar.')
    }
  })
}

function abrirModalPagamento(id) {
  document.getElementById('pagamentoIdConta').value = id
  document.getElementById('modalPagamento').style.display = 'flex'
}
function fecharModalPagamento() {
  document.getElementById('modalPagamento').style.display = 'none'
  document.getElementById('fileProof').value = ''
}
async function confirmarPagamentoComAnexo() {
  const id = document.getElementById('pagamentoIdConta').value
  const fileInput = document.getElementById('fileProof')
  let proof_file = null
  if (fileInput && fileInput.files.length > 0)
    proof_file = await convertBase64(fileInput.files[0])

  try {
    await fetch(`${API_URL}/bills/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pago', proof_file })
    })
    fecharModalPagamento()
    carregarContas()
  } catch (error) {
    alert('Erro ao pagar.')
  }
}

async function excluirConta(id) {
  if (!confirm('Excluir conta?')) return
  try {
    await fetch(`${API_URL}/bills/${id}`, { method: 'DELETE' })
    carregarContas()
  } catch (error) {
    alert('Erro ao excluir.')
  }
}

// ==========================================
// 6. LEITOR BOLETO
// ==========================================
function preencherFormularioComCodigo(codigo) {
  const linhaLimpa = codigo.replace(/[^0-9]/g, '')
  document.getElementById('leitorResultado').innerText = 'Código Detectado!'
  document.getElementById('desc').value = `Boleto: ${linhaLimpa}`
  if (linhaLimpa.length === 47) {
    const valorRaw = linhaLimpa.substring(37, 47)
    const valorFinal = (parseInt(valorRaw) / 100).toFixed(2)
    const fatorVencimento = parseInt(linhaLimpa.substring(33, 37))
    const dataBase = new Date('1997-10-07T00:00:00Z')
    dataBase.setDate(dataBase.getDate() + fatorVencimento)
    document.getElementById('amount').value = valorFinal
    document.getElementById('date').value = dataBase.toISOString().split('T')[0]
  } else if (linhaLimpa.length === 48) {
    const valorRaw = linhaLimpa.substring(4, 15)
    document.getElementById('amount').value = (
      parseInt(valorRaw) / 100
    ).toFixed(2)
    document.getElementById('date').value = new Date()
      .toISOString()
      .split('T')[0]
  }
}
function analisarBoleto() {
  const inputManual = document.getElementById('linhaDigitavelManual')
  const codigoDigitado = inputManual
    ? inputManual.value.trim().replace(/[^0-9]/g, '')
    : ''
  if (codigoDigitado.length > 10) {
    preencherFormularioComCodigo(codigoDigitado)
    return
  }
  const fileInput = document.getElementById('boletoFile')
  if (fileInput && fileInput.files[0]) {
    const reader = new FileReader()
    reader.onload = e => {
      Quagga.decodeSingle(
        {
          decoder: { readers: ['i2of5_reader'] },
          locate: true,
          src: e.target.result
        },
        res => {
          if (res && res.code) preencherFormularioComCodigo(res.code)
          else
            document.getElementById('leitorResultado').innerText =
              'Não foi possível ler.'
        }
      )
    }
    reader.readAsDataURL(fileInput.files[0])
  } else {
    alert('Digite o código ou carregue uma imagem.')
  }
}
const btnAnalise = document.getElementById('iniciarLeitorBtn')
if (btnAnalise) btnAnalise.addEventListener('click', analisarBoleto)

// ==========================================
// 7. MÓDULOS ADMIN, ESTOQUE, RELATÓRIOS
// ==========================================
// (ADMIN)
async function carregarUsuarios() {
  if (usuarioLogado.role !== 'admin') return
  const tbody = document.getElementById('listaUsuarios')
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>'
  try {
    const response = await fetch(`${API_URL}/users`)
    const users = await response.json()
    tbody.innerHTML = ''
    users.forEach(u => {
      const cargo = u.role === 'admin' ? '<b>Admin</b>' : 'Colaborador'
      let acoes =
        u.id !== usuarioLogado.id
          ? `<button onclick="abrirModalEditarUsuario('${u.id}', '${u.name}', '${u.email}', '${u.role}')" style="background:#f59e0b; padding:5px 10px; font-size:0.8rem; margin-right:5px;">✏️</button> <button onclick="excluirUsuario(${u.id})" style="background:var(--danger); padding:5px 10px; font-size:0.8rem;">Remover</button>`
          : '<span style="color:#ccc;">(Você)</span>'
      tbody.innerHTML += `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding:10px;">#${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${cargo}</td><td>${acoes}</td></tr>`
    })
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5">Erro.</td></tr>'
  }
}
const formUser = document.getElementById('formNovoUsuario')
if (formUser) {
  formUser.addEventListener('submit', async e => {
    e.preventDefault()
    const name = document.getElementById('newUserName').value
    const email = document.getElementById('newUserEmail').value
    const password = document.getElementById('newUserPass').value
    const role = document.getElementById('newUserRole').value
    try {
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      })
      if (response.ok) {
        alert('Cadastrado!')
        document.getElementById('formNovoUsuario').reset()
        carregarUsuarios()
      } else {
        alert('Erro.')
      }
    } catch (error) {
      alert('Erro.')
    }
  })
}
function abrirModalEditarUsuario(id, name, email, role) {
  document.getElementById('editUserId').value = id
  document.getElementById('editUserName').value = name
  document.getElementById('editUserEmail').value = email
  document.getElementById('editUserRole').value = role
  document.getElementById('modalEditarUsuario').style.display = 'flex'
}
async function salvarEdicaoUsuario() {
  const id = document.getElementById('editUserId').value
  const name = document.getElementById('editUserName').value
  const email = document.getElementById('editUserEmail').value
  const role = document.getElementById('editUserRole').value
  try {
    await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role })
    })
    alert('Atualizado!')
    document.getElementById('modalEditarUsuario').style.display = 'none'
    carregarUsuarios()
  } catch (error) {
    alert('Erro.')
  }
}
async function excluirUsuario(id) {
  if (!confirm('Remover?')) return
  await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' })
  carregarUsuarios()
}

// (ESTOQUE)
async function carregarEstoque() {
  const tbody = document.getElementById('listaEstoque')
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>'
  try {
    const response = await fetch(`${API_URL}/inventory`)
    const items = await response.json()
    tbody.innerHTML = ''
    if (items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">Vazio.</td></tr>'
      return
    }
    items.forEach(item => {
      tbody.innerHTML += `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding:10px;">${item.name}</td><td>${item.category}</td><td><b>${item.quantity}</b></td><td>R$ ${item.price}</td><td><button onclick="excluirItemEstoque(${item.id})" style="background:var(--danger); padding:4px 8px;">🗑️</button></td></tr>`
    })
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="5">Erro.</td></tr>'
  }
}
const formEstoque = document.getElementById('formEstoque')
if (formEstoque) {
  formEstoque.addEventListener('submit', async e => {
    e.preventDefault()
    const name = document.getElementById('prodName').value
    const category = document.getElementById('prodCategory').value
    const quantity = document.getElementById('prodQtd').value
    const price = document.getElementById('prodPrice').value
    try {
      await fetch(`${API_URL}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, quantity, price })
      })
      alert('Cadastrado!')
      document.getElementById('formEstoque').reset()
      carregarEstoque()
    } catch (error) {
      alert('Erro.')
    }
  })
}
async function excluirItemEstoque(id) {
  if (!confirm('Excluir?')) return
  await fetch(`${API_URL}/inventory/${id}`, { method: 'DELETE' })
  carregarEstoque()
}

// (ORÇAMENTO)
async function carregarOpcoesEstoque() {
  const select = document.getElementById('orcSelectEstoque')
  try {
    const response = await fetch(`${API_URL}/inventory`)
    listaProdutosCache = await response.json()
    select.innerHTML = '<option value="">Selecione...</option>'
    listaProdutosCache.forEach(item => {
      select.innerHTML += `<option value="${item.id}">${item.name} (R$ ${item.price})</option>`
    })
  } catch (error) {
    select.innerHTML = '<option>Erro</option>'
  }
}
function adicionarAoOrcamento() {
  const idProd = document.getElementById('orcSelectEstoque').value
  const qtd = parseInt(document.getElementById('orcQtd').value)
  if (!idProd || qtd <= 0) return alert('Inválido.')
  const produto = listaProdutosCache.find(p => p.id == idProd)
  itensOrcamento.push({
    name: produto.name,
    qtd: qtd,
    price: parseFloat(produto.price),
    total: parseFloat(produto.price) * qtd
  })
  renderizarTabelaOrcamento()
}
function renderizarTabelaOrcamento() {
  const tbody = document.getElementById('listaOrcamento')
  const totalEl = document.getElementById('orcTotalFinal')
  tbody.innerHTML = ''
  let grandTotal = 0
  itensOrcamento.forEach((item, index) => {
    grandTotal += item.total
    tbody.innerHTML += `<tr><td>${item.name}</td><td>${
      item.qtd
    }</td><td>R$ ${item.price.toFixed(2)}</td><td>R$ ${item.total.toFixed(
      2
    )}</td><td><button onclick="removerItemOrcamento(${index})" style="color:red;border:none;">❌</button></td></tr>`
  })
  totalEl.innerText = `R$ ${grandTotal.toFixed(2)}`
}
function removerItemOrcamento(index) {
  itensOrcamento.splice(index, 1)
  renderizarTabelaOrcamento()
}
function gerarPDF() {
  const { jsPDF } = window.jspdf
  const doc = new jsPDF()
  const cliente = document.getElementById('orcClientName').value || 'Cliente'
  const docCliente = document.getElementById('orcClientDoc').value || ''
  doc.setFillColor(13, 71, 161)
  doc.rect(0, 0, 210, 40, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.text('VERTICLOG', 15, 20)
  doc.setFontSize(12)
  doc.text('Orçamento', 15, 30)
  doc.setTextColor(0, 0, 0)
  doc.text(`Cliente: ${cliente}`, 15, 55)
  doc.text(`Doc: ${docCliente}`, 15, 62)
  const dados = itensOrcamento.map(i => [
    i.name,
    i.qtd,
    `R$ ${i.price.toFixed(2)}`,
    `R$ ${i.total.toFixed(2)}`
  ])
  doc.autoTable({
    startY: 70,
    head: [['Item', 'Qtd', 'Unit', 'Total']],
    body: dados,
    theme: 'striped',
    headStyles: { fillColor: [13, 71, 161] }
  })
  const finalY = doc.lastAutoTable.finalY + 10
  const totalGeral = itensOrcamento.reduce((acc, i) => acc + i.total, 0)
  doc.setFontSize(14)
  doc.text(`TOTAL: R$ ${totalGeral.toFixed(2)}`, 140, finalY)
  doc.save(`Orcamento_${cliente}.pdf`)
}

// (RELATÓRIOS)
async function carregarRelatorios() {
  try {
    const url = `${API_URL}/bills?userId=${usuarioLogado.id}&userRole=${usuarioLogado.role}`
    const response = await fetch(url)

    // Guarda TODOS os dados originais no cache
    dadosRelatorioCache = await response.json()

    // Renderiza (inicialmente mostra tudo ou podemos aplicar um filtro padrão de 'este mês')
    renderizarTabelaRelatorios(dadosRelatorioCache)
  } catch (e) {
    console.error(e)
  }
}

function renderizarTabelaRelatorios(lista) {
  let tPendente = 0,
    tPago = 0,
    tAtrasado = 0
  const hoje = new Date()
  const tbody = document.getElementById('listaRelatorio')
  tbody.innerHTML = ''

  if (lista.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center; padding:15px;">Nenhum dado no período selecionado.</td></tr>'
    // Zera KPIs visualmente
    document.getElementById('kpiPendente').innerText = 'R$ 0.00'
    document.getElementById('kpiPago').innerText = 'R$ 0.00'
    document.getElementById('kpiAtrasado').innerText = 'R$ 0.00'
    return
  }

  lista.forEach(c => {
    const val = parseFloat(c.amount)
    const dataVenc = new Date(c.due_date)

    // Atualiza KPIs com base na lista FILTRADA
    if (c.status === 'pago') tPago += val
    else {
      tPendente += val
      if (dataVenc < hoje) tAtrasado += val
    }

    const cor =
      c.status === 'pago' ? 'green' : dataVenc < hoje ? 'red' : 'orange'
    const txt =
      c.status === 'pago' ? 'Pago' : dataVenc < hoje ? 'Atrasado' : 'Pendente'

    tbody.innerHTML += `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding:10px;">${dataVenc.toLocaleDateString('pt-BR', {
              timeZone: 'UTC'
            })}</td>
            <td>${c.description}</td>
            <td>R$ ${val.toFixed(2)}</td>
            <td style="color:${cor}; font-weight:bold;">${txt}</td>
        </tr>`
  })

  // Atualiza os cartões com os totais FILTRADOS
  document.getElementById('kpiPendente').innerText = `R$ ${tPendente.toFixed(
    2
  )}`
  document.getElementById('kpiPago').innerText = `R$ ${tPago.toFixed(2)}`
  document.getElementById('kpiAtrasado').innerText = `R$ ${tAtrasado.toFixed(
    2
  )}`
}

function filtrarRelatorios() {
  const inicio = document.getElementById('filtroRelInicio').value
  const fim = document.getElementById('filtroRelFim').value
  const status = document.getElementById('filtroRelStatus').value

  const filtrados = dadosRelatorioCache.filter(c => {
    const dataConta = c.due_date.split('T')[0]
    let dOk = true
    if (inicio && dataConta < inicio) dOk = false
    if (fim && dataConta > fim) dOk = false

    let sOk = true
    if (status !== 'todos' && c.status !== status) sOk = false

    return dOk && sOk
  })

  renderizarTabelaRelatorios(filtrados)
}

function exportarExcel() {
  // Exporta apenas o que está visível/filtrado no momento?
  // Vamos re-aplicar o filtro para garantir ou usar uma variável global 'dadosAtuais'.
  // Simplificação: Exporta o que está na tela (recalculando o filtro)

  const inicio = document.getElementById('filtroRelInicio').value
  const fim = document.getElementById('filtroRelFim').value
  const status = document.getElementById('filtroRelStatus').value

  const dadosParaExportar = dadosRelatorioCache.filter(c => {
    const dataConta = c.due_date.split('T')[0]
    let dOk = true
    if (inicio && dataConta < inicio) dOk = false
    if (fim && dataConta > fim) dOk = false
    let sOk = true
    if (status !== 'todos' && c.status !== status) sOk = false
    return dOk && sOk
  })

  if (dadosParaExportar.length === 0)
    return alert('Sem dados para exportar com este filtro.')

  const dados = dadosParaExportar.map(c => ({
    Descrição: c.description,
    Valor: parseFloat(c.amount),
    Vencimento: new Date(c.due_date).toLocaleDateString('pt-BR', {
      timeZone: 'UTC'
    }),
    Responsável: c.user_name,
    Status: c.status.toUpperCase()
  }))

  const ws = XLSX.utils.json_to_sheet(dados)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Finanças')
  XLSX.writeFile(wb, 'Relatorio_Verticlog.xlsx')
}
// === INICIALIZAÇÃO ===
if (typeof FullCalendar !== 'undefined') iniciarCalendario()
carregarContas()

// === FUNÇÃO DE NOTIFICAÇÃO DE VENCIMENTO (INTERATIVA) ===
function verificarVencimentosHoje(contas) {
  const hoje = new Date().toLocaleDateString('pt-BR')

  const contasHoje = contas.filter(c => {
    const dataConta = new Date(c.due_date).toLocaleDateString('pt-BR', {
      timeZone: 'UTC'
    })
    return c.status === 'pendente' && dataConta === hoje
  })

  if (contasHoje.length > 0) {
    const divLista = document.getElementById('listaAlertaConteudo')
    divLista.innerHTML = ''

    contasHoje.forEach(c => {
      // Criamos um item clicável que leva direto ao pagamento
      divLista.innerHTML += `
                <div onclick="irParaPagamentoDoAlerta(${c.id})" 
                     style="border-bottom: 1px solid #ffdcdc; padding: 10px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; background:white; border-radius:4px; margin-bottom:5px; transition: background 0.2s;">
                    
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:bold; color:#c0392b;">${c.description}</span>
                        <small style="color:#7f8c8d;">Clique para pagar</small>
                    </div>
                    
                    <div style="text-align:right;">
                        <span style="font-weight:bold; font-size:1.1rem; display:block;">R$ ${c.amount}</span>
                        <span style="background:#27ae60; color:white; font-size:0.7rem; padding:2px 6px; border-radius:4px;">PAGAR ➔</span>
                    </div>
                </div>
            `
    })

    document.getElementById('modalAlertaHoje').style.display = 'flex'
  }
}

// Função auxiliar para fechar o alerta e abrir o pagamento
function irParaPagamentoDoAlerta(id) {
  document.getElementById('modalAlertaHoje').style.display = 'none' // Fecha o alerta
  abrirModalPagamento(id) // Abre o modal de pagamento (já existente)
}
