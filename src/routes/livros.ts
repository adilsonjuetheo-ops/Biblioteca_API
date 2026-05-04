import { Router } from 'express';
import { db } from '../db/connection';
import { livros } from '../db/schema';
import { and, asc, count, eq, ilike, or, sql } from 'drizzle-orm';
import { livrosCache } from '../cache';

const router = Router();

const CAMPOS_LISTA = {
  id: livros.id,
  titulo: livros.titulo,
  autor: livros.autor,
  isbn: livros.isbn,
  genero: livros.genero,
  capa: livros.capa,
  prateleira: livros.prateleira,
  totalExemplares: livros.totalExemplares,
  disponiveis: livros.disponiveis,
};

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(0, Number(req.query.limit) || 0));
    const busca = String(req.query.search || '').trim();
    const genero = String(req.query.genero || '').trim();
    const autor = String(req.query.autor || '').trim();
    const somenteDisponiveis = req.query.somenteDisponiveis === 'true';
    const incluirTotal = req.query.incluirTotal === 'true';
    const cacheKey = `livros:p${page}:l${limit}:s${busca}:g${genero}:a${autor}:d${somenteDisponiveis}`;

    const cached = livrosCache.get(cacheKey);
    if (cached) {
      if (Array.isArray(cached)) {
        return res.json(cached);
      }
      const cacheObj = cached as { items: unknown[]; total: number };
      if (incluirTotal) {
        res.setHeader('X-Total-Count', String(cacheObj.total));
      }
      return res.json(cacheObj.items);
    }

    const filtros = [];
    if (busca) {
      filtros.push(or(
        ilike(livros.titulo, `%${busca}%`),
        ilike(livros.autor, `%${busca}%`),
        ilike(livros.isbn, `%${busca}%`)
      ));
    }
    if (genero) filtros.push(eq(livros.genero, genero));
    if (autor) filtros.push(ilike(livros.autor, `%${autor}%`));
    if (somenteDisponiveis) filtros.push(sql`${livros.disponiveis} > 0`);
    const whereClause = filtros.length ? and(...filtros) : undefined;

    let query = db.select(CAMPOS_LISTA).from(livros).$dynamic();
    if (whereClause) query = query.where(whereClause);
    query = query.orderBy(asc(livros.titulo));
    const resultado = limit > 0
      ? await query.limit(limit).offset((page - 1) * limit)
      : await query;

    let total = resultado.length;
    if (limit > 0 || incluirTotal) {
      let totalQuery = db.select({ total: count() }).from(livros).$dynamic();
      if (whereClause) totalQuery = totalQuery.where(whereClause);
      const totalRows = await totalQuery;
      total = Number(totalRows[0]?.total || 0);
      res.setHeader('X-Total-Count', String(total));
      res.setHeader('X-Page', String(page));
      res.setHeader('X-Limit', String(limit));
    }

    livrosCache.set(cacheKey, { items: resultado, total });
    res.json(resultado);
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

// BUG CORRIGIDO: req.body substituído por campos explícitos (evita mass assignment)
// Antes: db.insert(livros).values(req.body) — qualquer campo podia ser forjado
router.post('/', async (req, res) => {
  try {
    const { titulo, autor, isbn, genero, sinopse, capa, prateleira, totalExemplares } = req.body;

    if (!titulo || !titulo.trim()) {
      return res.status(400).json({ erro: 'Título é obrigatório' });
    }

    const total = Number(totalExemplares) || 1;

    const novo = await db.insert(livros).values({
      titulo: titulo.trim(),
      autor: autor?.trim() || null,
      isbn: isbn?.trim() || null,
      genero: genero?.trim() || null,
      sinopse: sinopse?.trim() || null,
      capa: capa?.trim() || null,
      prateleira: prateleira?.trim() || null,
      totalExemplares: total,
      disponiveis: total,
    }).returning();

    livrosCache.flushAll();
    res.status(201).json(novo[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao adicionar livro' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { titulo, autor, isbn, genero, sinopse, capa, prateleira, totalExemplares, disponiveis } = req.body;

    const atualizado = await db.update(livros)
      .set({
        titulo: titulo?.trim(),
        autor: autor?.trim() || null,
        isbn: isbn !== undefined ? (isbn?.trim() || null) : undefined,
        genero: genero?.trim() || null,
        sinopse: sinopse?.trim() || null,
        capa: capa?.trim() || null,
        prateleira: prateleira !== undefined ? (prateleira?.trim() || null) : undefined,
        totalExemplares: totalExemplares !== undefined ? Number(totalExemplares) : undefined,
        disponiveis: disponiveis !== undefined ? Number(disponiveis) : undefined,
      })
      .where(eq(livros.id, Number(req.params.id)))
      .returning();

    if (!atualizado.length) {
      return res.status(404).json({ erro: 'Livro não encontrado' });
    }

    livrosCache.flushAll();
    res.json(atualizado[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar livro' });
  }
});

// BUG CORRIGIDO: rota PATCH ausente — app mobile chama PATCH /livros/:id
// para ajustar estoque (handleAjustarEstoque) — retornava 404
router.patch('/:id', async (req, res) => {
  try {
    const { totalExemplares, disponiveis } = req.body;

    const livroAtual = await db.select().from(livros)
      .where(eq(livros.id, Number(req.params.id)));

    if (!livroAtual.length) {
      return res.status(404).json({ erro: 'Livro não encontrado' });
    }

    const atualizado = await db.update(livros)
      .set({
        ...(totalExemplares !== undefined && { totalExemplares: Number(totalExemplares) }),
        ...(disponiveis !== undefined && { disponiveis: Number(disponiveis) }),
      })
      .where(eq(livros.id, Number(req.params.id)))
      .returning();

    livrosCache.flushAll();
    res.json(atualizado[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar livro' });
  }
});

// BUG CORRIGIDO: rota DELETE ausente — app mobile chama DELETE /livros/:id
// em handleRemoverLivro — retornava 404
router.delete('/:id', async (req, res) => {
  try {
    const livroAtual = await db.select().from(livros)
      .where(eq(livros.id, Number(req.params.id)));

    if (!livroAtual.length) {
      return res.status(404).json({ erro: 'Livro não encontrado' });
    }

    if ((livroAtual[0].disponiveis ?? 0) < (livroAtual[0].totalExemplares ?? 0)) {
      return res.status(400).json({
        erro: 'Não é possível remover um livro com exemplares emprestados',
      });
    }

    await db.delete(livros).where(eq(livros.id, Number(req.params.id)));
    livrosCache.flushAll();
    res.json({ mensagem: 'Livro removido com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover livro' });
  }
});

export default router;
