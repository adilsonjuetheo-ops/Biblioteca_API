import { Router } from 'express';
import { db } from '../db/connection';
import { usuarios } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const router = Router();

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

// Cadastro
router.post('/', async (req, res) => {
  try {
    const { nome, email, senha, matricula, turma, perfil } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
    }
    const existe = await db.select().from(usuarios).where(eq(usuarios.email, email));
    if (existe.length > 0) {
      return res.status(400).json({ erro: 'E-mail já cadastrado' });
    }
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const novo = await db.insert(usuarios).values({
      nome, email, senha: senhaCriptografada,
      matricula, turma, perfil: perfil || 'aluno',
    }).returning({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      perfil: usuarios.perfil,
    });
    res.status(201).json(novo[0]);
  } catch (err) {
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
    const resultado = await db.select().from(usuarios).where(eq(usuarios.email, email));
    if (resultado.length === 0) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    const usuario = resultado[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
    }
    res.json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      matricula: usuario.matricula,
      turma: usuario.turma,
      perfil: usuario.perfil,
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

// Buscar por email
router.get('/email/:email', async (req, res) => {
  try {
    const usuario = await db.select().from(usuarios)
      .where(eq(usuarios.email, req.params.email));
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

// Alias: POST /cadastro → same as POST /
router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha, matricula, turma, perfil } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
    }
    const existe = await db.select().from(usuarios).where(eq(usuarios.email, email.toLowerCase().trim()));
    if (existe.length > 0) {
      return res.status(400).json({ erro: 'E-mail já cadastrado' });
    }
    const senhaCriptografada = await bcrypt.hash(senha, 10);
    const novo = await db.insert(usuarios).values({
      nome,
      email: email.toLowerCase().trim(),
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

// Stub: recuperação de senha (não implementada com e-mail)
router.post('/recuperar-senha', (_req, res) => {
  res.status(503).json({ erro: 'Recuperação por e-mail não disponível neste momento.' });
});

router.post('/recuperar-senha/verificar', (_req, res) => {
  res.status(503).json({ erro: 'Recuperação por e-mail não disponível neste momento.' });
});