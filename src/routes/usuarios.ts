import { Router } from 'express';
import { db } from '../db/connection';
import { usuarios } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const todos = await db.select().from(usuarios);
    res.json(todos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar usuários' });
  }
});

router.post('/', async (req, res) => {
  try {
    const novo = await db.insert(usuarios).values(req.body).returning();
    res.status(201).json(novo[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

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

router.delete('/:id', async (req, res) => {
  try {
    await db.delete(usuarios)
      .where(eq(usuarios.id, Number(req.params.id)));
    res.json({ mensagem: 'Usuário removido com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover usuário' });
  }
});

export default router;