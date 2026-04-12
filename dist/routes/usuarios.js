"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const resend_1 = require("resend");
const connection_2 = require("../db/connection");
const router = (0, express_1.Router)();
const resend = new resend_1.Resend(process.env.RESEND_API_KEY);
async function enviarEmailRecuperacao(email, nome, codigo) {
    await resend.emails.send({
        from: 'Biblioteca BMSQ <biblioteca@adilsondev.com.br>',
        to: email,
        subject: 'Codigo de recuperacao de senha - Biblioteca BMSQ',
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #fdfaf4; border-radius: 16px; padding: 32px; border: 1px solid #d9cfbe;">
        <h2 style="color: #1a1208; margin-bottom: 4px;">Biblioteca Marlene de Souza Queiroz</h2>
        <p style="color: #8a7d68; font-size: 13px; margin-top: 0;">E. E. Cel. Jose Venancio de Souza</p>
        <hr style="border: none; border-top: 1px solid #d9cfbe; margin: 20px 0;" />
        <p style="color: #1a1208;">Ola, <strong>${nome}</strong>!</p>
        <p style="color: #1a1208;">Recebemos uma solicitacao para redefinir a senha da sua conta. Use o codigo abaixo:</p>
        <div style="background: #1a1208; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="color: #f0a84a; font-size: 36px; font-weight: 700; letter-spacing: 8px;">${codigo}</span>
        </div>
        <p style="color: #8a7d68; font-size: 13px;">Este codigo expira em <strong>15 minutos</strong>.</p>
        <p style="color: #8a7d68; font-size: 13px;">Se voce nao solicitou a recuperacao de senha, ignore este e-mail.</p>
        <hr style="border: none; border-top: 1px solid #d9cfbe; margin: 20px 0;" />
        <p style="color: #8a7d68; font-size: 11px; text-align: center;">Biblioteca BMSQ - Sistema de Gestao de Acervo</p>
      </div>
    `,
    });
}
router.get('/', async (req, res) => {
    try {
        const todos = await connection_1.db.select({
            id: schema_1.usuarios.id,
            nome: schema_1.usuarios.nome,
            email: schema_1.usuarios.email,
            matricula: schema_1.usuarios.matricula,
            turma: schema_1.usuarios.turma,
            perfil: schema_1.usuarios.perfil,
            criadoEm: schema_1.usuarios.criadoEm,
        }).from(schema_1.usuarios);
        res.json(todos);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar usuarios' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { nome, email, senha, matricula, turma, perfil } = req.body;
        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, e-mail e senha sao obrigatorios' });
        }
        const emailNormalizado = email.toLowerCase().trim();
        const existe = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        if (existe.length > 0) {
            return res.status(400).json({ erro: 'E-mail ja cadastrado' });
        }
        const senhaCriptografada = await bcryptjs_1.default.hash(senha, 10);
        const novo = await connection_1.db.insert(schema_1.usuarios).values({
            nome, email: emailNormalizado, senha: senhaCriptografada,
            matricula, turma, perfil: perfil || 'aluno',
        }).returning({
            id: schema_1.usuarios.id, nome: schema_1.usuarios.nome, email: schema_1.usuarios.email,
            perfil: schema_1.usuarios.perfil, matricula: schema_1.usuarios.matricula, turma: schema_1.usuarios.turma,
        });
        res.status(201).json(novo[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao criar usuario' });
    }
});
router.post('/cadastro', async (req, res) => {
    try {
        const { nome, email, senha, matricula, turma, perfil } = req.body;
        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, e-mail e senha sao obrigatorios' });
        }
        const emailNormalizado = email.toLowerCase().trim();
        const existe = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        if (existe.length > 0) {
            return res.status(400).json({ erro: 'E-mail ja cadastrado' });
        }
        const senhaCriptografada = await bcryptjs_1.default.hash(senha, 10);
        const novo = await connection_1.db.insert(schema_1.usuarios).values({
            nome, email: emailNormalizado, senha: senhaCriptografada,
            matricula, turma, perfil: perfil || 'aluno',
        }).returning({
            id: schema_1.usuarios.id, nome: schema_1.usuarios.nome, email: schema_1.usuarios.email,
            perfil: schema_1.usuarios.perfil, matricula: schema_1.usuarios.matricula, turma: schema_1.usuarios.turma,
        });
        res.status(201).json(novo[0]);
    }
    catch {
        res.status(500).json({ erro: 'Erro ao criar usuario' });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ erro: 'E-mail e senha sao obrigatorios' });
        }
        const emailNormalizado = email.toLowerCase().trim();
        const resultado = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        if (resultado.length === 0) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }
        const usuario = resultado[0];
        const senhaCorreta = await bcryptjs_1.default.compare(senha, usuario.senha);
        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }
        const token = (0, auth_1.gerarToken)({ id: usuario.id, email: usuario.email, perfil: usuario.perfil });
        res.json({
            id: usuario.id, nome: usuario.nome, email: usuario.email,
            matricula: usuario.matricula, turma: usuario.turma,
            perfil: usuario.perfil, token,
        });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao fazer login' });
    }
});
router.post('/recuperar-senha', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ erro: 'E-mail e obrigatorio' });
        const emailNormalizado = email.toLowerCase().trim();
        const resultado = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        if (resultado.length === 0) {
            return res.json({ mensagem: 'Se o e-mail estiver cadastrado, voce recebera o codigo em breve.' });
        }
        const usuario = resultado[0];
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expira = new Date(Date.now() + 15 * 60 * 1000);
        await connection_2.pool.query('UPDATE usuarios SET recuperacao_codigo = $1, recuperacao_expira_em = $2 WHERE id = $3', [codigo, expira, usuario.id]);
        await enviarEmailRecuperacao(emailNormalizado, usuario.nome, codigo);
        res.json({ mensagem: 'Codigo enviado para o seu e-mail. Verifique a caixa de entrada.' });
    }
    catch (err) {
        console.error('[recuperar-senha] erro:', err);
        res.status(500).json({ erro: 'Erro ao processar recuperacao de senha' });
    }
});
router.post('/redefinir-senha', async (req, res) => {
    try {
        const { email, codigo, novaSenha } = req.body;
        if (!email || !codigo || !novaSenha) {
            return res.status(400).json({ erro: 'E-mail, codigo e nova senha sao obrigatorios' });
        }
        if (novaSenha.length < 6) {
            return res.status(400).json({ erro: 'A nova senha deve ter no minimo 6 caracteres' });
        }
        const emailNormalizado = email.toLowerCase().trim();
        const resultado = await connection_2.pool.query('SELECT * FROM usuarios WHERE email = $1 AND recuperacao_codigo = $2 AND recuperacao_expira_em > NOW()', [emailNormalizado, codigo.trim()]);
        if (resultado.rows.length === 0) {
            return res.status(400).json({ erro: 'Codigo invalido ou expirado' });
        }
        const senhaCriptografada = await bcryptjs_1.default.hash(novaSenha, 10);
        await connection_2.pool.query('UPDATE usuarios SET senha = $1, recuperacao_codigo = NULL, recuperacao_expira_em = NULL WHERE email = $2', [senhaCriptografada, emailNormalizado]);
        res.json({ mensagem: 'Senha redefinida com sucesso' });
    }
    catch (err) {
        console.error('[redefinir-senha] erro:', err);
        res.status(500).json({ erro: 'Erro ao redefinir senha' });
    }
});
router.get('/email/:email', async (req, res) => {
    try {
        const usuario = await connection_1.db.select({
            id: schema_1.usuarios.id, nome: schema_1.usuarios.nome, email: schema_1.usuarios.email,
            matricula: schema_1.usuarios.matricula, turma: schema_1.usuarios.turma,
            perfil: schema_1.usuarios.perfil, criadoEm: schema_1.usuarios.criadoEm,
        }).from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, req.params.email));
        if (!usuario.length)
            return res.status(404).json({ erro: 'Usuario nao encontrado' });
        res.json(usuario[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar usuario' });
    }
});
router.get('/deletar-conta', (_req, res) => {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Excluir Conta — Biblioteca BMSQ</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      background: #fdfaf4;
      color: #1a1208;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #fff;
      border: 1px solid #d9cfbe;
      border-radius: 16px;
      padding: 40px 36px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 4px 24px rgba(26,18,8,0.07);
    }
    .header h1 {
      font-size: 17px;
      color: #1a1208;
      line-height: 1.3;
    }
    .header p {
      font-size: 12px;
      color: #8a7d68;
      margin-top: 2px;
    }
    hr { border: none; border-top: 1px solid #d9cfbe; margin: 20px 0; }
    .aviso {
      background: #fff4e5;
      border: 1px solid #f0a84a;
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 13px;
      color: #7a4f00;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .aviso strong { color: #c07000; }
    label {
      display: block;
      font-size: 13px;
      font-weight: bold;
      color: #1a1208;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid #d9cfbe;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: #1a1208;
      background: #fdfaf4;
      outline: none;
      transition: border-color 0.2s;
      margin-bottom: 16px;
    }
    input:focus { border-color: #f0a84a; }
    button {
      width: 100%;
      padding: 12px;
      background: #1a1208;
      color: #f0a84a;
      border: none;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      font-size: 15px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 4px;
    }
    button:hover { background: #2e2010; }
    button:disabled { background: #8a7d68; color: #d9cfbe; cursor: not-allowed; }
    #msg {
      margin-top: 16px;
      font-size: 13px;
      text-align: center;
      min-height: 20px;
    }
    .msg-erro { color: #c0392b; }
    .msg-ok { color: #1a7a4a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Biblioteca Marlene de Souza Queiroz<br>/ E. E. Cel. José Venâncio de Souza</h1>
      <p>Sistema de Gestão de Acervo</p>
    </div>
    <hr />
    <div class="aviso">
      <strong>⚠ Atenção: esta ação é irreversível.</strong><br />
      Ao excluir sua conta, todos os seus dados e o histórico de empréstimos serão permanentemente removidos e não poderão ser recuperados.
    </div>
    <form id="form">
      <label for="email">E-mail</label>
      <input type="email" id="email" placeholder="seu@email.com" required />
      <label for="senha">Senha</label>
      <input type="password" id="senha" placeholder="Sua senha" required />
      <button type="submit" id="btn">Excluir minha conta</button>
    </form>
    <div id="msg"></div>
  </div>
  <script>
    const form = document.getElementById('form');
    const btn = document.getElementById('btn');
    const msg = document.getElementById('msg');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'Aguarde...';
      msg.textContent = '';
      msg.className = '';

      const email = document.getElementById('email').value.trim();
      const senha = document.getElementById('senha').value;

      try {
        const loginRes = await fetch('/usuarios/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, senha }),
        });
        const loginData = await loginRes.json();

        if (!loginRes.ok) {
          msg.textContent = loginData.erro || 'E-mail ou senha incorretos.';
          msg.className = 'msg-erro';
          btn.disabled = false;
          btn.textContent = 'Excluir minha conta';
          return;
        }

        const deleteRes = await fetch('/usuarios/deletar-conta', {
          method: 'DELETE',
          headers: { 'Authorization': 'Bearer ' + loginData.token },
        });
        const deleteData = await deleteRes.json();

        if (!deleteRes.ok) {
          msg.textContent = deleteData.erro || 'Erro ao excluir a conta.';
          msg.className = 'msg-erro';
          btn.disabled = false;
          btn.textContent = 'Excluir minha conta';
          return;
        }

        msg.textContent = deleteData.mensagem || 'Conta excluída com sucesso.';
        msg.className = 'msg-ok';
        form.style.display = 'none';
        btn.style.display = 'none';
      } catch (err) {
        msg.textContent = 'Erro de conexão. Tente novamente.';
        msg.className = 'msg-erro';
        btn.disabled = false;
        btn.textContent = 'Excluir minha conta';
      }
    });
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
});
router.delete('/deletar-conta', auth_1.autenticar, async (req, res) => {
    try {
        const payload = req.usuarioAutenticado;
        await connection_1.db.delete(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.id, payload.id));
        res.json({ mensagem: 'Conta excluida com sucesso' });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao excluir conta' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await connection_1.db.delete(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.id, Number(req.params.id)));
        res.json({ mensagem: 'Usuario removido com sucesso' });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao remover usuario' });
    }
});
exports.default = router;
