// web/js/login.js

document
  .getElementById('loginForm')
  .addEventListener('submit', async function (event) {
    event.preventDefault() // Impede a página de recarregar

    const email = document.getElementById('email').value
    const password = document.getElementById('password').value
    const msgErro = document.getElementById('msgErro')

    // Limpa erro anterior
    msgErro.style.display = 'none'
    msgErro.innerText = ''

    try {
      // Usa a variável API_URL que definimos no outro arquivo
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        // Sucesso!
        localStorage.setItem('usuarioVerticlog', JSON.stringify(data.user))
        // Redireciona para o painel dentro da pasta pages
        window.location.href = 'pages/dashboard.html'
      } else {
        // Erro (senha errada, etc)
        msgErro.innerText = data.message
        msgErro.style.display = 'block'
      }
    } catch (error) {
      console.error(error)
      msgErro.innerText = 'Erro ao conectar com o servidor.'
      msgErro.style.display = 'block'
    }
  })
