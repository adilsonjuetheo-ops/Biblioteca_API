import { Router } from 'express';
import { db } from '../db/connection';
import { emprestimos, livros } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const todos = await db.select().from(emprestimos);
    res.json(todos);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar empréstimos' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { usuarioId, livroId } = req.body;
    const novo = await db.insert(emprestimos)
      .values({ usuarioId, livroId, status: 'reservado' })
      .returning();
    await db.update(livros)
      .set({ disponiveis: sql`${livros.disponiveis} - 1` })
      .where(eq(livros.id, livroId));
    res.status(201).json(novo[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar reserva' });
  }
});

router.patch('/:id/devolver', async (req, res) => {
  try {
    const emp = await db.update(emprestimos)
      .set({ status: 'devolvido', dataDevolucao: new Date() })
      .where(eq(emprestimos.id, Number(req.params.id)))
      .returning();
    await db.update(livros)
      .set({ disponiveis: sql`${livros.disponiveis} + 1` })
      .where(eq(livros.id, emp[0].livroId));
    res.status(200).json(emp[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar devolução' });
  }
});

export default router;