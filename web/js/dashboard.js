// web/js/dashboard.js

// ==========================================
// 0. VARIÁVEIS GLOBAIS E AUTENTICAÇÃO
// ==========================================
let calendar
let contasCache = []
let itensOrcamento = []
let dadosRelatorioCache = []
let chartBar = null
let chartPie = null

// --- SISTEMA DE NOTIFICAÇÃO (TOAST) ---
function showToast(mensagem, tipo = 'success') {
  const container = document.getElementById('toast-container')
  if (!container) return alert(mensagem) // Fallback se não tiver container

  const toast = document.createElement('div')
  toast.className = `toast ${tipo}`
  toast.innerText = mensagem

  container.appendChild(toast)

  // Remove automaticamente
  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.5s ease forwards'
    setTimeout(() => toast.remove(), 500)
  }, 3000)
}

const usuarioLogado = JSON.parse(localStorage.getItem('usuarioVerticlog'))

if (!usuarioLogado) {
  alert('Você precisa fazer login!')
  window.location.href = '../index.html'
} else {
  const welcome = document.getElementById('welcomeMsg')
  if (welcome) welcome.innerText = `Olá, ${usuarioLogado.name}`

  const role = document.getElementById('userRoleDisplay')
  if (role)
    role.innerText =
      usuarioLogado.role === 'admin' ? 'Administrador' : 'Colaborador'

  const init = document.getElementById('userInitials')
  if (init) init.innerText = usuarioLogado.name.charAt(0).toUpperCase()
}

function logout() {
  localStorage.removeItem('usuarioVerticlog')
  window.location.href = '../index.html'
}

// ==========================================
// 1. FUNÇÕES ÚTEIS (FORMATADORES & ARQUIVOS)
// ==========================================

// Formata dinheiro (R$ 1.000,00)
const formatarMoeda = valor => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor)
}

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
  if (!conta) return showToast('Erro ao encontrar arquivo.', 'error')

  const base64Data = tipo === 'conta' ? conta.bill_file : conta.proof_file
  if (!base64Data) return showToast('Nenhum arquivo anexado.', 'info')

  fetch(base64Data)
    .then(res => res.blob())
    .then(blob => {
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    })
    .catch(() => {
      const win = window.open()
      win.document.write(
        '<iframe src="' +
          base64Data +
          '" frameborder="0" style="border:0; width:100%; height:100%;"></iframe>'
      )
    })
}

async function baixarBackup() {
  console.log('Iniciando backup...')
  try {
    const response = await fetch(`${API_URL}/backup`)
    if (!response.ok) throw new Error('Erro ao gerar backup')

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = url

    const dataStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
    a.download = `backup_verticlog_${dataStr}.json`

    document.body.appendChild(a)
    a.click()

    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    showToast('Backup baixado com sucesso!', 'success')
  } catch (error) {
    console.error(error)
    showToast('Falha no backup. Verifique o servidor.', 'error')
  }
}

// ==========================================
// 2. MÓDULO FINANCEIRO (CONTAS E RECEITAS)
// ==========================================
async function carregarContas() {
  const listaElement = document.getElementById('listaContas')
  if (!listaElement) return
  listaElement.innerHTML = '<tr><td colspan="6">Carregando...</td></tr>'

  try {
    const url = `${API_URL}/bills?userId=${usuarioLogado.id}&userRole=${usuarioLogado.role}`
    const response = await fetch(url)
    const contas = await response.json()

    // ORDENAÇÃO: Mais novos primeiro
    contas.sort((a, b) => b.id - a.id)

    contasCache = contas
    verificarVencimentosHoje(contas)

    listaElement.innerHTML = ''

    if (contas.length === 0) {
      listaElement.innerHTML =
        '<tr><td colspan="6" style="text-align:center; padding:15px;">Nenhum lançamento encontrado.</td></tr>'
      return
    }

    contas.forEach(conta => {
      const dataFormatada = new Date(conta.due_date).toLocaleDateString(
        'pt-BR',
        { timeZone: 'UTC' }
      )
      const isReceita = conta.type === 'income'
      const corValor = isReceita ? '#16a34a' : '#ef4444'
      const sinal = isReceita ? '+' : '-'
      const valorFormatado = formatarMoeda(conta.amount)

      let botoesArquivo = ''
      if (conta.bill_file)
        botoesArquivo += `<button onclick="verArquivo(${conta.id}, 'conta')" class="btn-file btn-bill" title="Ver Conta">📄 Conta</button>`
      if (conta.proof_file)
        botoesArquivo += `<button onclick="verArquivo(${conta.id}, 'proof')" class="btn-file btn-proof" title="Ver Comp">🧾 Comp.</button>`

      let statusHtml =
        conta.status === 'pendente'
          ? `<span style="color:${
              isReceita ? '#ca8a04' : 'orange'
            }; font-weight:bold;">Pendente</span>`
          : `<span style="color:green; font-weight:bold;">Concluído</span> ✓`
      let acaoHtml =
        conta.status === 'pendente'
          ? `<button onclick="abrirModalPagamento(${conta.id})" class="action-btn btn-pay" title="Pagar/Receber">✅</button>`
          : `<span style="color:#ccc;">-</span>`

      const btnExcluir = `<button onclick="excluirConta(${conta.id})" class="action-btn btn-delete">🗑️</button>`
      const btnEditar = `<button onclick="abrirModalEditarConta('${conta.id}', '${conta.description}', '${conta.amount}', '${conta.due_date}', '${conta.status}', '${conta.type}')" class="action-btn btn-edit">✏️</button>`

      const descHTML = `<div style="display:flex; flex-direction:column; gap:5px;"><span style="font-weight:600;">${conta.description}</span><div style="display:flex;">${botoesArquivo}</div></div>`

      listaElement.innerHTML += `<tr style="border-bottom: 1px solid #eee;"><td style="padding:12px;">${descHTML}</td><td style="font-weight:600; color:${corValor}; white-space:nowrap;">${sinal} ${valorFormatado}</td><td>${dataFormatada}</td><td>${conta.user_name}</td><td>${statusHtml}</td><td style="white-space:nowrap;">${acaoHtml} ${btnEditar} ${btnExcluir}</td></tr>`
    })

    if (calendar) calendar.refetchEvents()
  } catch (error) {
    console.error(error)
    listaElement.innerHTML =
      '<tr><td colspan="6" style="color:red">Erro de conexão.</td></tr>'
  }
}

// ADICIONAR CONTA (COM TOAST)
const formConta = document.getElementById('formConta')
if (formConta) {
  formConta.addEventListener('submit', async e => {
    e.preventDefault()

    const btnSalvar = formConta.querySelector('button[type="submit"]')
    const txtOriginal = btnSalvar.innerText
    btnSalvar.innerText = 'Salvando...'
    btnSalvar.disabled = true

    const description = document.getElementById('desc').value
    const amount = document.getElementById('amount').value
    const due_date = document.getElementById('date').value
    const fileInput = document.getElementById('fileBill')
    const typeEl = document.querySelector(
      'input[name="tipoLancamento"]:checked'
    )
    const type = typeEl ? typeEl.value : 'expense'
    const chkRepetir = document.getElementById('chkRepetir')
    const repeatMonths = chkRepetir.checked
      ? document.getElementById('repeatMonths').value
      : null

    let bill_file = null
    if (fileInput && fileInput.files.length > 0)
      bill_file = await convertBase64(fileInput.files[0])

    try {
      await fetch(`${API_URL}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          amount,
          due_date,
          user_id: usuarioLogado.id,
          bill_file,
          repeat_months: repeatMonths,
          type
        })
      })
      showToast('Lançamento salvo com sucesso!', 'success')
      document.getElementById('formConta').reset()

      if (chkRepetir) {
        chkRepetir.checked = false
        document.getElementById('boxMeses').style.display = 'none'
      }
      if (fileInput) fileInput.value = ''

      carregarContas()
    } catch (error) {
      showToast('Erro ao salvar.', 'error')
    } finally {
      btnSalvar.innerText = txtOriginal
      btnSalvar.disabled = false
    }
  })
}

// FILTRO DA TABELA
function filtrarTabelaContas() {
  const inicio = document.getElementById('filtroContaInicio').value
  const fim = document.getElementById('filtroContaFim').value
  const status = document.getElementById('filtroContaStatus').value

  const filtrados = contasCache.filter(c => {
    const dataConta = c.due_date.split('T')[0]
    let ok = true
    if (inicio && dataConta < inicio) ok = false
    if (fim && dataConta > fim) ok = false
    if (status !== 'todos' && c.status !== status) ok = false
    return ok
  })

  const listaElement = document.getElementById('listaContas')
  listaElement.innerHTML = ''

  if (filtrados.length === 0) {
    listaElement.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:15px;">Nenhum resultado.</td></tr>'
    return
  }

  filtrados.forEach(conta => {
    const dataFormatada = new Date(conta.due_date).toLocaleDateString('pt-BR', {
      timeZone: 'UTC'
    })
    const isReceita = conta.type === 'income'
    const corValor = isReceita ? '#16a34a' : '#ef4444'
    const sinal = isReceita ? '+' : '-'
    const valorFormatado = formatarMoeda(conta.amount)

    let botoesArquivo = ''
    if (conta.bill_file)
      botoesArquivo += `<button onclick="verArquivo(${conta.id}, 'conta')" class="btn-file btn-bill">📄 Conta</button>`
    if (conta.proof_file)
      botoesArquivo += `<button onclick="verArquivo(${conta.id}, 'proof')" class="btn-file btn-proof">🧾 Comp.</button>`

    let statusHtml =
      conta.status === 'pendente'
        ? `<span style="color:${
            isReceita ? '#ca8a04' : 'orange'
          }; font-weight:bold;">Pendente</span>`
        : `<span style="color:green; font-weight:bold;">Concluído</span> ✓`
    let acaoHtml =
      conta.status === 'pendente'
        ? `<button onclick="abrirModalPagamento(${conta.id})" class="action-btn btn-pay">✅</button>`
        : `<span style="color:#ccc;">-</span>`

    const btnExcluir = `<button onclick="excluirConta(${conta.id})" class="action-btn btn-delete">🗑️</button>`
    const btnEditar = `<button onclick="abrirModalEditarConta('${conta.id}', '${conta.description}', '${conta.amount}', '${conta.due_date}', '${conta.status}')" class="action-btn btn-edit">✏️</button>`

    const descHTML = `<div style="display:flex; flex-direction:column; gap:5px;"><span style="font-weight:600;">${conta.description}</span><div style="display:flex;">${botoesArquivo}</div></div>`

    listaElement.innerHTML += `<tr style="border-bottom: 1px solid #eee;"><td style="padding:12px;">${descHTML}</td><td style="font-weight:600; color:${corValor}; white-space:nowrap;">${sinal} ${valorFormatado}</td><td>${dataFormatada}</td><td>${conta.user_name}</td><td>${statusHtml}</td><td style="white-space:nowrap;">${acaoHtml} ${btnEditar} ${btnExcluir}</td></tr>`
  })
}

function limparFiltrosContas() {
  document.getElementById('filtroContaInicio').value = ''
  document.getElementById('filtroContaFim').value = ''
  document.getElementById('filtroContaStatus').value = 'todos'
  carregarContas()
}

function abrirModalPagamento(id) {
  document.getElementById('pagamentoIdConta').value = id
  document.getElementById('modalPagamento').style.display = 'flex'
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
    document.getElementById('modalPagamento').style.display = 'none'
    showToast('Baixa realizada com sucesso!', 'success')
    carregarContas()
  } catch (error) {
    showToast('Erro ao pagar.', 'error')
  }
}

async function excluirConta(id) {
  if (!confirm('Tem certeza que deseja excluir?')) return
  try {
    await fetch(`${API_URL}/bills/${id}`, { method: 'DELETE' })
    showToast('Conta excluída.', 'info')
    carregarContas()
  } catch (error) {
    showToast('Erro ao excluir.', 'error')
  }
}

// ==========================================
// 3. CALENDÁRIO & DETALHES DO DIA
// ==========================================
function iniciarCalendario() {
  var calendarEl = document.getElementById('calendar')
  if (!calendarEl) return
  const isMobile = window.innerWidth < 768

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: isMobile ? 'listMonth' : 'dayGridMonth',
    locale: 'pt-br',
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: isMobile ? 'listMonth' : 'dayGridMonth,listMonth'
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
    },
    eventClick: function (info) {
      abrirDetalhesDoDia(info.event.startStr)
    },
    dateClick: function (info) {
      abrirDetalhesDoDia(info.dateStr)
    }
  })
  calendar.render()
}

function mapearEventos(contas) {
  return contas.map(c => ({
    title: `${formatarMoeda(c.amount)} - ${c.description}`,
    start: c.due_date.split('T')[0],
    color:
      c.type === 'income'
        ? '#16a34a'
        : c.status === 'pendente'
        ? '#ef4444'
        : '#2563eb',
    extendedProps: { status: c.status }
  }))
}

function abrirDetalhesDoDia(dataIso) {
  const dataObj = new Date(dataIso + 'T00:00:00')
  document.getElementById(
    'tituloDetalhesDia'
  ).innerText = `Dia ${dataObj.toLocaleDateString('pt-BR')}`

  const contasDoDia = contasCache.filter(
    c => c.due_date.split('T')[0] === dataIso
  )
  const div = document.getElementById('conteudoDetalhesDia')
  div.innerHTML = ''

  if (contasDoDia.length === 0) {
    div.innerHTML =
      '<p style="text-align:center; color:#666;">Nada para hoje.</p>'
  } else {
    let html = '<div style="display:flex; flex-direction:column; gap:10px;">'

    contasDoDia.forEach(c => {
      const isReceita = c.type === 'income'
      const corValor = isReceita ? '#16a34a' : '#ef4444'
      const valorFmt = formatarMoeda(c.amount)

      let botoesArquivo = ''
      if (c.bill_file)
        botoesArquivo += `<button onclick="verArquivo(${c.id}, 'conta')" class="btn-file btn-bill">📄 Conta</button>`
      if (c.proof_file)
        botoesArquivo += `<button onclick="verArquivo(${c.id}, 'proof')" class="btn-file btn-proof">🧾 Comp.</button>`

      let btnAcao = ''
      if (c.status === 'pendente') {
        btnAcao = `<button onclick="fecharDetalhesEAbirPagamento(${
          c.id
        })" style="background:${
          isReceita ? '#27ae60' : '#2980b9'
        }; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem; margin-top:5px; width:100%;">
                    ${isReceita ? 'Receber ✅' : 'Pagar 💸'}
                </button>`
      } else {
        btnAcao = `<div style="text-align:center; font-size:0.8rem; color:green; margin-top:5px; font-weight:bold;">Concluído ✓</div>`
      }

      html += `
            <div style="border:1px solid #eee; border-radius:8px; padding:10px; background:#fff;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <span style="font-weight:600;">${c.description}</span>
                    <span style="font-weight:bold; color:${corValor}">${valorFmt}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>${botoesArquivo}</div>
                    <small style="color:#666;">${c.user_name || ''}</small>
                </div>
                ${btnAcao}
            </div>`
    })
    html += '</div>'
    div.innerHTML = html
  }
  document.getElementById('modalDetalhesDia').style.display = 'flex'
}

function fecharDetalhesEAbirPagamento(id) {
  document.getElementById('modalDetalhesDia').style.display = 'none'
  abrirModalPagamento(id)
}

// ==========================================
// 4. MÓDULO DE EDIÇÃO
// ==========================================
function abrirModalEditarConta(id, desc, amount, date, status, type) {
  document.getElementById('editContaId').value = id
  document.getElementById('editContaDesc').value = desc
  document.getElementById('editContaValor').value = amount

  const dataLimpa = date.split('T')[0]
  document.getElementById('editContaData').value = dataLimpa
  document.getElementById('editContaStatus').value = status

  const fileBill = document.getElementById('editFileBill')
  if (fileBill) fileBill.value = ''

  const fileProof = document.getElementById('editFileProof')
  if (fileProof) fileProof.value = ''

  if (document.getElementById('editChkRepetir')) {
    document.getElementById('editChkRepetir').checked = false
    document.getElementById('editBoxMeses').style.display = 'none'
  }

  document.getElementById('modalEditarConta').style.display = 'flex'
}

async function salvarEdicaoConta() {
  const id = document.getElementById('editContaId').value
  const description = document.getElementById('editContaDesc').value
  const amount = document.getElementById('editContaValor').value
  const due_date = document.getElementById('editContaData').value
  const status = document.getElementById('editContaStatus').value

  const chkRepetir = document.getElementById('editChkRepetir')
  const repeatMonths =
    chkRepetir && chkRepetir.checked
      ? document.getElementById('editRepeatMonths').value
      : null

  const inputBill = document.getElementById('editFileBill')
  const rmBill = document.getElementById('rmFileBill')
    ? document.getElementById('rmFileBill').checked
    : false

  const inputProof = document.getElementById('editFileProof')
  const rmProof = document.getElementById('rmFileProof')
    ? document.getElementById('rmFileProof').checked
    : false

  if (!description || !amount || !due_date)
    return showToast('Preencha todos os campos.', 'error')

  const payload = {
    description,
    amount,
    due_date,
    status,
    repeat_months: repeatMonths
  }

  if (rmBill) payload.bill_file = 'REMOVE'
  else if (inputBill && inputBill.files.length > 0)
    payload.bill_file = await convertBase64(inputBill.files[0])

  if (rmProof) payload.proof_file = 'REMOVE'
  else if (inputProof && inputProof.files.length > 0)
    payload.proof_file = await convertBase64(inputProof.files[0])

  try {
    await fetch(`${API_URL}/bills/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    showToast('Atualizado com sucesso!', 'success')
    document.getElementById('modalEditarConta').style.display = 'none'
    contasCache = []
    carregarContas()
  } catch (error) {
    console.error(error)
    showToast('Erro ao atualizar.', 'error')
  }
}

function toggleEditRepetir() {
  const chk = document.getElementById('editChkRepetir')
  document.getElementById('editBoxMeses').style.display = chk.checked
    ? 'flex'
    : 'none'
}

// ==========================================
// 5. MÓDULO RELATÓRIOS
// ==========================================
async function carregarRelatorios() {
  try {
    const url = `${API_URL}/bills?userId=${usuarioLogado.id}&userRole=${usuarioLogado.role}`
    const response = await fetch(url)
    dadosRelatorioCache = await response.json()
    renderizarDashboards(dadosRelatorioCache)
  } catch (e) {
    console.error(e)
  }
}

function renderizarDashboards(dados) {
  let receita = 0,
    despesaPendente = 0,
    despesaPaga = 0
  const tbody = document.getElementById('listaRelatorio')
  if (tbody) tbody.innerHTML = ''

  dados.forEach(c => {
    const val = parseFloat(c.amount)
    const isReceita = c.type === 'income'

    if (isReceita) {
      receita += val
    } else {
      if (c.status === 'pago') despesaPaga += val
      else despesaPendente += val
    }

    const cor = isReceita ? 'green' : 'red'
    const sinal = isReceita ? '+' : '-'
    const valorFmt = formatarMoeda(val)
    const statusTxt = isReceita
      ? 'Recebido'
      : c.status === 'pago'
      ? 'Pago'
      : 'Pendente'

    if (tbody) {
      tbody.innerHTML += `<tr style="border-bottom: 1px solid #eee;">
                <td>${new Date(c.due_date).toLocaleDateString('pt-BR', {
                  timeZone: 'UTC'
                })}</td>
                <td style="color:${cor}; font-weight:bold;">${
        isReceita ? 'Receita' : 'Despesa'
      }</td>
                <td>${c.description}</td>
                <td>${sinal} ${valorFmt}</td>
                <td>${statusTxt}</td>
            </tr>`
    }
  })

  const saldo = receita - (despesaPendente + despesaPaga)

  if (document.getElementById('kpiReceita'))
    document.getElementById('kpiReceita').innerText = formatarMoeda(receita)
  if (document.getElementById('kpiPendente'))
    document.getElementById('kpiPendente').innerText =
      formatarMoeda(despesaPendente)
  if (document.getElementById('kpiPago'))
    document.getElementById('kpiPago').innerText = formatarMoeda(despesaPaga)
  if (document.getElementById('kpiSaldo')) {
    document.getElementById('kpiSaldo').innerText = formatarMoeda(saldo)
    document.getElementById('kpiSaldo').style.color =
      saldo >= 0 ? '#16a34a' : '#ef4444'
  }

  atualizarGraficos(receita, despesaPaga, despesaPendente)
}

function atualizarGraficos(receita, pago, pendente) {
  const ctxBar = document.getElementById('graficoBarras')
  const ctxPie = document.getElementById('graficoPizza')

  if (!ctxBar || !ctxPie) return

  if (chartBar) chartBar.destroy()
  if (chartPie) chartPie.destroy()

  chartBar = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: ['Receitas', 'Despesas Totais'],
      datasets: [
        {
          label: 'Fluxo de Caixa',
          data: [receita, pago + pendente],
          backgroundColor: ['#16a34a', '#ef4444']
        }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  })

  chartPie = new Chart(ctxPie, {
    type: 'doughnut',
    data: {
      labels: ['Pago', 'Pendente'],
      datasets: [
        {
          data: [pago, pendente],
          backgroundColor: ['#2563eb', '#ca8a04']
        }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  })
}

function filtrarRelatorios() {
  const inicio = document.getElementById('filtroRelInicio').value
  const fim = document.getElementById('filtroRelFim').value
  const filtrados = dadosRelatorioCache.filter(c => {
    const dataConta = c.due_date.split('T')[0]
    let ok = true
    if (inicio && dataConta < inicio) ok = false
    if (fim && dataConta > fim) ok = false
    return ok
  })
  renderizarDashboards(filtrados)
}

function exportarExcel() {
  if (dadosRelatorioCache.length === 0)
    return showToast('Sem dados para exportar.', 'info')
  const dados = dadosRelatorioCache.map(c => ({
    Data: new Date(c.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
    Tipo: c.type === 'income' ? 'Receita' : 'Despesa',
    Descrição: c.description,
    Valor: parseFloat(c.amount),
    Status: c.status
  }))
  const ws = XLSX.utils.json_to_sheet(dados)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Relatorio')
  XLSX.writeFile(wb, 'Verticlog_Relatorio.xlsx')
}

// ==========================================
// 6. MÓDULO ESTOQUE
// ==========================================
async function carregarEstoque() {
  const tbody = document.getElementById('listaEstoque')
  if (!tbody) return
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
      let alertaHtml = ''
      if (item.is_low)
        alertaHtml =
          '<span style="color:red; font-size:0.8rem; font-weight:bold; margin-left:5px;">⚠️ Baixo!</span>'

      tbody.innerHTML += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:10px;">${item.name}</td>
                <td>${item.category}</td>
                <td><b>${item.quantity}</b> ${alertaHtml}</td>
                <td>${formatarMoeda(item.price)}</td>
                <td><button onclick="excluirItemEstoque(${
                  item.id
                })" style="background:#ef4444; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">🗑️</button></td>
            </tr>`
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
    const min_quantity = document.getElementById('prodMin').value

    try {
      await fetch(`${API_URL}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, quantity, price, min_quantity })
      })
      showToast('Item Cadastrado!', 'success')
      document.getElementById('formEstoque').reset()
      carregarEstoque()
    } catch (error) {
      showToast('Erro ao cadastrar.', 'error')
    }
  })
}

async function excluirItemEstoque(id) {
  if (!confirm('Excluir?')) return
  await fetch(`${API_URL}/inventory/${id}`, { method: 'DELETE' })
  carregarEstoque()
}

// Leitor de Boleto
async function converterPdfParaImagem(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2.0 })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  canvas.height = viewport.height
  canvas.width = viewport.width
  await page.render({ canvasContext: context, viewport: viewport }).promise
  return canvas.toDataURL('image/png')
}

function preencherFormularioComCodigo(codigo) {
  const linhaLimpa = codigo.replace(/[^0-9]/g, '')
  document.getElementById('leitorResultado').innerText = '✅ Código Detectado!'
  document.getElementById('desc').value = `Boleto Lido: ${linhaLimpa}`
  if (linhaLimpa.length >= 40) {
    const valorRaw = linhaLimpa.substring(linhaLimpa.length - 10)
    document.getElementById('amount').value = (
      parseInt(valorRaw) / 100
    ).toFixed(2)
    document.getElementById('date').value = new Date()
      .toISOString()
      .split('T')[0]
  }
}

async function analisarBoleto() {
  const inputManual = document.getElementById('linhaDigitavelManual')
  const codigoDigitado = inputManual
    ? inputManual.value.trim().replace(/[^0-9]/g, '')
    : ''
  if (codigoDigitado.length > 10) {
    preencherFormularioComCodigo(codigoDigitado)
    return
  }
  const fileInput = document.getElementById('boletoFile')
  if (!fileInput || !fileInput.files[0]) {
    alert('Carregue um arquivo ou digite o código.')
    return
  }
  const file = fileInput.files[0]
  document.getElementById('leitorResultado').innerText = '⏳ Lendo arquivo...'
  let imageSrc = null
  try {
    if (file.type === 'application/pdf') {
      imageSrc = await converterPdfParaImagem(file)
    } else {
      imageSrc = await convertBase64(file)
    }
    Quagga.decodeSingle(
      { decoder: { readers: ['i2of5_reader'] }, locate: true, src: imageSrc },
      function (result) {
        if (result && result.codeResult && result.codeResult.code) {
          preencherFormularioComCodigo(result.codeResult.code)
        } else {
          document.getElementById('leitorResultado').innerText =
            '❌ Código não encontrado. Tente digitar.'
        }
      }
    )
  } catch (e) {
    document.getElementById('leitorResultado').innerText =
      'Erro ao processar arquivo.'
  }
}

const btnAnalise = document.getElementById('iniciarLeitorBtn')
if (btnAnalise) {
  const novoBtn = btnAnalise.cloneNode(true)
  btnAnalise.parentNode.replaceChild(novoBtn, btnAnalise)
  novoBtn.addEventListener('click', analisarBoleto)
}

// 8. ADMIN
async function carregarUsuarios() {
  if (usuarioLogado.role !== 'admin') {
    const tbody = document.getElementById('listaUsuarios')
    if (tbody)
      tbody.innerHTML = '<tr><td colspan="5">Acesso restrito.</td></tr>'
    return
  }
  const tbody = document.getElementById('listaUsuarios')
  if (!tbody) return
  tbody.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>'
  try {
    const response = await fetch(`${API_URL}/users`)
    const users = await response.json()
    tbody.innerHTML = ''
    users.forEach(u => {
      const cargoHtml = u.role === 'admin' ? 'Admin' : 'Colaborador'
      let acoes =
        u.id !== usuarioLogado.id
          ? `<button onclick="abrirModalEditarUsuario('${u.id}','${u.name}','${u.email}','${u.role}')" class="action-btn btn-edit">✏️</button> <button onclick="excluirUsuario(${u.id})" class="action-btn btn-delete">🗑️</button>`
          : '(Você)'
      tbody.innerHTML += `<tr style="border-bottom: 1px solid #eee;"><td style="padding:10px;">#${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${cargoHtml}</td><td>${acoes}</td></tr>`
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
        showToast('Cadastrado!', 'success')
        document.getElementById('formNovoUsuario').reset()
        carregarUsuarios()
      } else {
        showToast('Erro ao cadastrar.', 'error')
      }
    } catch (error) {
      showToast('Erro conexão.', 'error')
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
    const response = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role })
    })
    if (response.ok) {
      showToast('Atualizado!', 'success')
      document.getElementById('modalEditarUsuario').style.display = 'none'
      carregarUsuarios()
    } else {
      showToast('Erro.', 'error')
    }
  } catch (error) {
    showToast('Erro conexão.', 'error')
  }
}

async function excluirUsuario(id) {
  if (!confirm('Remover?')) return
  try {
    await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' })
    carregarUsuarios()
  } catch (error) {
    showToast('Erro.', 'error')
  }
}

// 9. ALERTAS DO DIA
function verificarVencimentosHoje(contas) {
  const hoje = new Date().toLocaleDateString('pt-BR')
  const contasHoje = contas.filter(c => {
    const dataConta = new Date(c.due_date).toLocaleDateString('pt-BR', {
      timeZone: 'UTC'
    })
    return c.status === 'pendente' && dataConta === hoje && c.type !== 'income'
  })

  if (contasHoje.length > 0) {
    const divLista = document.getElementById('listaAlertaConteudo')
    if (divLista) {
      divLista.innerHTML = ''
      contasHoje.forEach(c => {
        divLista.innerHTML += `<div style="border-bottom:1px solid #fee2e2; padding:10px; display:flex; justify-content:space-between;">
                    <span style="color:#ef4444; font-weight:bold;">${
                      c.description
                    }</span>
                    <span>${formatarMoeda(c.amount)}</span>
                </div>`
      })
      document.getElementById('modalAlertaHoje').style.display = 'flex'
    }
  }
}

// INICIALIZAÇÃO
if (typeof FullCalendar !== 'undefined') iniciarCalendario()
carregarContas()
