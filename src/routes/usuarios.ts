import { Router } from 'express';
import { db } from '../db/connection';
import { usuarios } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { gerarToken } from '../middleware/auth';
import nodemailer from 'nodemailer';
import { pool } from '../db/connection';

const router = Router();

// Configuração do transporter de e-mail
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function enviarEmailRecuperacao(email: string, nome: string, codigo: string) {
  await transporter.sendMail({
    from: `"Biblioteca BMSQ" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: '🔐 Código de recuperação de senha — Biblioteca BMSQ',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #fdfaf4; border-radius: 16px; padding: 32px; border: 1px solid #d9cfbe;">
        <h2 style="color: #1a1208; margin-bottom: 4px;">Biblioteca Marlene de Souza Queiroz</h2>
        <p style="color: #8a7d68; font-size: 13px; margin-top: 0;">E. E. Cel. José Venâncio de Souza</p>
        <hr style="border: none; border-top: 1px solid #d9cfbe; margin: 20px 0;" />
        <p style="color: #1a1208;">Olá, <strong>${nome}</strong>!</p>
        <p style="color: #1a1208;">Recebemos uma solicitação para redefinir a senha da sua conta. Use o código abaixo:</p>
        <div style="background: #1a1208; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="color: #f0a84a; font-size: 36px; font-weight: 700; letter-spacing: 8px;">${codigo}</span>
        </div>
        <p style="color: #8a7d68; font-size: 13px;">Este código expira em <strong>15 minutos</strong>.</p>
        <p style="color: #8a7d68; font-size: 13px;">Se você não solicitou a recuperação de senha, ignore este e-mail.</p>
        <hr style="border: none; border-top: 1px solid #d9cfbe; margin: 20px 0;" />
        <p style="color: #8a7d68; font-size: 11px; text-align: center;">Biblioteca BMSQ · Sistema de Gestão de Acervo</p>
      </div>
    `,
  });
}

// Listar usuários
router.get('/', async (req, res) => {
  try {
    const todos = await db.select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      matricula: usuarios.matricula,
      turma: usuarios.turma,
      perfil: usuarios.perfil,
      criadoEm: usuarios.criadoEm,
    }).from(usuarios);
    res.json(todos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar usuários' });
  }
});

// Cadastro principal
router.post('/', async (req, res) => {
  try {
    const { nome, email, senha, matricula, turma, perfil } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
    }
    const emailNormalizado = email.toLowerCase().trim();
    const existe = await db.select().from(usuarios).where(eq(usuarios.email, emailNormalizado));
    if (existe.length > 0) {
      return res.status(400).json({ erro: 'E-mail já cadastrado' });
    }
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const novo = await db.insert(usuarios).values({
      nome,
      email: emailNormalizado,
      senha: senhaCriptografada,
      matricula,
      turma,
      perfil: perfil || 'aluno',
    }).returning({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      perfil: usuarios.perfil,
      matricula: usuarios.matricula,
      turma: usuarios.turma,
    });
    res.status(201).json(novo[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

// Alias POST /cadastro
router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha, matricula, turma, perfil } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
    }
    const emailNormalizado = email.toLowerCase().trim();
    const existe = await db.select().from(usuarios).where(eq(usuarios.email, emailNormalizado));
    if (existe.length > 0) {
      return res.status(400).json({ erro: 'E-mail já cadastrado' });
    }
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const novo = await db.insert(usuarios).values({
      nome,
      email: emailNormalizado,
      senha: senhaCriptografada,
      matricula,
      turma,
      perfil: perfil || 'aluno',
    }).returning({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      perfil: usuarios.perfil,
      matricula: usuarios.matricula,
      turma: usuarios.turma,
    });
    res.status(201).json(novo[0]);
  } catch {
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ erro: 'E-mail e senha são obrigatórios' });
    }
    const emailNormalizado = email.toLowerCase().trim();
    const resultado = await db.select().from(usuarios).where(eq(usuarios.email, emailNormalizado));
    if (resultado.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    const usuario = resultado[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    const token = gerarToken({
      id: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
    });
    res.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      matricula: usuario.matricula,
      turma: usuario.turma,
      perfil: usuario.perfil,
      token,
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

// Recuperação de senha — envia código por e-mail e salva no banco
router.post('/recuperar-senha', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ erro: 'E-mail é obrigatório' });
    }
    const emailNormalizado = email.toLowerCase().trim();
    const resultado = await db.select().from(usuarios).where(eq(usuarios.email, emailNormalizado));

    // Sempre retorna a mesma mensagem para não revelar se o e-mail existe
    if (resultado.length === 0) {
      return res.json({ mensagem: 'Se o e-mail estiver cadastrado, você receberá o código em breve.' });
    }

    const usuario = resultado[0];
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = new Date(Date.now() + 15 * 60 * 1000);

    // Salva o código e expiração no banco
    await pool.query(
      `UPDATE usuarios SET recuperacao_codigo = $1, recuperacao_expira_em = $2 WHERE id = $3`,
      [codigo, expira, usuario.id]
    );

    // Envia o e-mail
    await enviarEmailRecuperacao(emailNormalizado, usuario.nome, codigo);

    res.json({ mensagem: 'Código enviado para o seu e-mail. Verifique a caixa de entrada.' });
  } catch (err) {
    console.error('[recuperar-senha] erro:', err);
    res.status(500).json({ erro: 'Erro ao processar recuperação de senha' });
  }
});

// Redefinir senha — valida código salvo no banco
router.post('/redefinir-senha', async (req, res) => {
  try {
    const { email, codigo, novaSenha } = req.body;
    if (!email || !codigo || !novaSenha) {
      return res.status(400).json({ erro: 'E-mail, código e nova senha são obrigatórios' });
    }
    if (novaSenha.length < 6) {
      return res.status(400).json({ erro: 'A nova senha deve ter no mínimo 6 caracteres' });
    }
    const emailNormalizado = email.toLowerCase().trim();

    // Busca usuário com código válido e não expirado
    const resultado = await pool.query(
      `SELECT * FROM usuarios
       WHERE email = $1
         AND recuperacao_codigo = $2
         AND recuperacao_expira_em > NOW()`,
      [emailNormalizado, codigo.trim()]
    );

    if (resultado.rows.length === 0) {
      return res.status(400).json({ erro: 'Código inválido ou expirado' });
    }

    const senhaCriptografada = await bcrypt.hash(novaSenha, 10);

    // Atualiza senha e limpa o código
    await pool.query(
      `UPDATE usuarios
       SET senha = $1, recuperacao_codigo = NULL, recuperacao_expira_em = NULL
       WHERE email = $2`,
      [senhaCriptografada, emailNormalizado]
    );

    res.json({ mensagem: 'Senha redefinida com sucesso' });
  } catch (err) {
    console.error('[redefinir-senha] erro:', err);
    res.status(500).json({ erro: 'Erro ao redefinir senha' });
  }
});

// Buscar por e-mail
router.get('/email/:email', async (req, res) => {
  try {
    const usuario = await db.select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      matricula: usuarios.matricula,
      turma: usuarios.turma,
      perfil: usuarios.perfil,
      criadoEm: usuarios.criadoEm,
    }).from(usuarios).where(eq(usuarios.email, req.params.email));
    if (!usuario.length) return res.status(404).json({ erro: 'Usuário não encontrado' });
    res.json(usuario[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar usuário' });
  }
});

// Deletar usuário
router.delete('/:id', async (req, res) => {
  try {
    await db.delete(usuarios).where(eq(usuarios.id, Number(req.params.id)));
    res.json({ mensagem: 'Usuário removido com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover usuário' });
  }
});

export default router;