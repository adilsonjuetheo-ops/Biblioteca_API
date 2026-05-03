import { Router } from 'express';
import { db } from '../db/connection';
import { desejos, livros } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { usuarioId } = req.query;

    let query = db
      .select({
        id: desejos.id,
        usuarioId: desejos.usuarioId,
        livroId: desejos.livroId,
        criadoEm: desejos.criadoEm,
        livroTitulo: livros.titulo,
        livroAutor: livros.autor,
        livroCapa: livros.capa,
        livroGenero: livros.genero,
        livroDisponiveis: livros.disponiveis,
      })
      .from(desejos)
      .leftJoin(livros, eq(desejos.livroId, livros.id))
      .$dynamic();

    if (usuarioId) query = query.where(eq(desejos.usuarioId, Number(usuarioId)));

    res.json(await query);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar desejos' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { usuarioId, livroId } = req.body;
    if (!usuarioId || !livroId) {
      return res.status(400).json({ erro: 'usuarioId e livroId são obrigatórios' });
    }

    const existente = await db
      .select()
      .from(desejos)
      .where(and(eq(desejos.usuarioId, Number(usuarioId)), eq(desejos.livroId, Number(livroId))));

    if (existente.length > 0) {
      // já existe -> remove (toggle)
      await db.delete(desejos).where(eq(desejos.id, existente[0].id));
      return res.json({ removido: true });
    }

    const novo = await db
      .insert(desejos)
      .values({ usuarioId: Number(usuarioId), livroId: Number(livroId) })
      .returning();
    res.status(201).json(novo[0]);
  } catch {
    res.status(500).json({ erro: 'Erro ao salvar desejo' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.delete(desejos).where(eq(desejos.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ erro: 'Erro ao remover desejo' });
  }
});

export default router;
