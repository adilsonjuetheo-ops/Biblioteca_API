import { Router } from 'express';
import { db } from '../db/connection';
import { livros } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const todos = await db.select().from(livros);
    res.json(todos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar livros' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const livro = await db.select().from(livros)
      .where(eq(livros.id, Number(req.params.id)));
    if (!livro.length) return res.status(404).json({ erro: 'Livro não encontrado' });
    res.json(livro[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar livro' });
  }
});

router.post('/', async (req, res) => {
  try {
    const novo = await db.insert(livros).values(req.body).returning();
    res.status(201).json(novo[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao adicionar livro' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const atualizado = await db.update(livros)
      .set(req.body)
      .where(eq(livros.id, Number(req.params.id)))
      .returning();
    res.json(atualizado[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar livro' });
  }
});

export default router;