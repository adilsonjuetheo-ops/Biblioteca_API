import { Router } from 'express';
import { db } from '../db/connection';
import { avaliacoes, usuarios, livros } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { usuarioId, livroId } = req.query;
    const filtros = [];
    if (usuarioId) filtros.push(eq(avaliacoes.usuarioId, Number(usuarioId)));
    if (livroId) filtros.push(eq(avaliacoes.livroId, Number(livroId)));

    let query = db
      .select({
        id: avaliacoes.id,
        usuarioId: avaliacoes.usuarioId,
        livroId: avaliacoes.livroId,
        nota: avaliacoes.nota,
        texto: avaliacoes.texto,
        criadoEm: avaliacoes.criadoEm,
        usuarioNome: usuarios.nome,
        livroTitulo: livros.titulo,
      })
      .from(avaliacoes)
      .leftJoin(usuarios, eq(avaliacoes.usuarioId, usuarios.id))
      .leftJoin(livros, eq(avaliacoes.livroId, livros.id))
      .$dynamic();

    if (filtros.length) query = query.where(and(...filtros));

    res.json(await query);
  } catch {
    res.status(500).json({ erro: 'Erro ao buscar avaliações' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { usuarioId, livroId, nota, texto } = req.body;
    if (!usuarioId || !livroId) {
      return res.status(400).json({ erro: 'usuarioId e livroId são obrigatórios' });
    }

    const existente = await db
      .select()
      .from(avaliacoes)
      .where(and(eq(avaliacoes.usuarioId, Number(usuarioId)), eq(avaliacoes.livroId, Number(livroId))));

    if (existente.length > 0) {
      const atualizado = await db
        .update(avaliacoes)
        .set({ nota: Number(nota), texto: String(texto || '') })
        .where(eq(avaliacoes.id, existente[0].id))
        .returning();
      return res.json(atualizado[0]);
    }

    const nova = await db
      .insert(avaliacoes)
      .values({ usuarioId: Number(usuarioId), livroId: Number(livroId), nota: Number(nota), texto: String(texto || '') })
      .returning();
    res.status(201).json(nova[0]);
  } catch {
    res.status(500).json({ erro: 'Erro ao salvar avaliação' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.delete(avaliacoes).where(eq(avaliacoes.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ erro: 'Erro ao remover avaliação' });
  }
});

export default router;
