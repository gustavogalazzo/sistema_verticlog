# 📦 Verticlog V3 - Sistema de Gestão Empresarial

Sistema completo de gestão financeira e logística (ERP), desenvolvido sob medida para controle de contas a pagar, estoque de porta-pallets e geração de orçamentos. O sistema é **Fullstack**, seguro e **100% Responsivo (Mobile/Desktop)**.

---

## 🚀 Funcionalidades Principais

### 💰 Módulo Financeiro
- **Contas a Pagar:** Cadastro rápido com Data, Valor e Descrição.
- **Leitor Inteligente:** Leitura de Código de Barras e Linha Digitável (Suporte a Imagens e PDFs) usando IA para extrair valor e vencimento.
- **Anexos Digitais:** Upload de Boleto (PDF/Img) e Comprovante de Pagamento.
- **Status:** Controle visual (Pendente 🟠 / Pago 🟢).
- **Calendário Interativo:** Visão mensal e lista diária de vencimentos.
- **Alertas:** Pop-up automático avisando de contas que vencem no dia.

### 📦 Módulo Logística & Comercial
- **Estoque:** Gestão de itens (Vigas, Montantes, Aço) com controle de quantidade e preço.
- **Orçamentos PDF:** Geração automática de orçamentos profissionais com logo e dados do cliente, prontos para enviar no WhatsApp.

### 📊 Gestão & Relatórios
- **Dashboard:** KPIs em tempo real (Total Pendente, Total Pago, Atrasados).
- **Relatórios:** Filtros por período e status com exportação para **Excel (.xlsx)**.
- **Níveis de Acesso:**
  - **Admin:** Vê tudo, cadastra usuários, edita registros.
  - **Colaborador:** Vê apenas seus lançamentos.

### 📱 Interface
- **Responsiva:** Funciona como um App no celular (Menu hambúrguer, tabelas em cartões, listas verticais).
- **Moderna:** Design limpo, ícones intuitivos e feedback visual.

---

## 🛠️ Tecnologias Utilizadas

**Frontend (Pasta `web`):**
- HTML5, CSS3 (Moderno/Flexbox/Grid).
- JavaScript (Vanilla ES6+).
- **Bibliotecas:** - `FullCalendar` (Agenda).
  - `QuaggaJS` (Leitor de Código de Barras).
  - `PDF.js` (Leitura de PDF).
  - `jsPDF` (Geração de PDF).
  - `SheetJS` (Exportação Excel).

**Backend (Pasta `api`):**
- Node.js.
- Express (Servidor Web).
- PostgreSQL (Banco de Dados).
- `pg` (Cliente Postgres).
- `cors` & `dotenv`.

**Hospedagem:**
- Render (API & Static Site).
- Neon/Render (PostgreSQL Database).

---

## ⚙️ Instalação e Configuração Local

### Pré-requisitos
- Node.js instalado.
- Git instalado.
- Um banco de dados PostgreSQL criado.

### 1. Clonar o Repositório
```bash
git clone [https://github.com/SEU_USUARIO/sistema-verticlog.git](https://github.com/SEU_USUARIO/sistema-verticlog.git)
cd sistema-verticlog