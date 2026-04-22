"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const cache_1 = require("../cache");
const router = (0, express_1.Router)();
const CAMPOS_LISTA = {
    id: schema_1.livros.id,
    titulo: schema_1.livros.titulo,
    autor: schema_1.livros.autor,
    isbn: schema_1.livros.isbn,
    genero: schema_1.livros.genero,
    sinopse: schema_1.livros.sinopse,
    capa: schema_1.livros.capa,
    prateleira: schema_1.livros.prateleira,
    totalExemplares: schema_1.livros.totalExemplares,
    disponiveis: schema_1.livros.disponiveis,
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
        const cached = cache_1.livrosCache.get(cacheKey);
        if (cached) {
            if (Array.isArray(cached)) {
                return res.json(cached);
            }
            const cacheObj = cached;
            if (incluirTotal) {
                res.setHeader('X-Total-Count', String(cacheObj.total));
            }
            return res.json(cacheObj.items);
        }
        const filtros = [];
        if (busca) {
            filtros.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.livros.titulo, `%${busca}%`), (0, drizzle_orm_1.ilike)(schema_1.livros.autor, `%${busca}%`), (0, drizzle_orm_1.ilike)(schema_1.livros.isbn, `%${busca}%`)));
        }
        if (genero)
            filtros.push((0, drizzle_orm_1.eq)(schema_1.livros.genero, genero));
        if (autor)
            filtros.push((0, drizzle_orm_1.ilike)(schema_1.livros.autor, `%${autor}%`));
        if (somenteDisponiveis)
            filtros.push((0, drizzle_orm_1.sql) `${schema_1.livros.disponiveis} > 0`);
        const whereClause = filtros.length ? (0, drizzle_orm_1.and)(...filtros) : undefined;
        let query = connection_1.db.select(CAMPOS_LISTA).from(schema_1.livros).$dynamic();
        if (whereClause)
            query = query.where(whereClause);
        query = query.orderBy((0, drizzle_orm_1.asc)(schema_1.livros.titulo));
        const resultado = limit > 0
            ? await query.limit(limit).offset((page - 1) * limit)
            : await query;
        let total = resultado.length;
        if (limit > 0 || incluirTotal) {
            let totalQuery = connection_1.db.select({ total: (0, drizzle_orm_1.count)() }).from(schema_1.livros).$dynamic();
            if (whereClause)
                totalQuery = totalQuery.where(whereClause);
            const totalRows = await totalQuery;
            total = Number(totalRows[0]?.total || 0);
            res.setHeader('X-Total-Count', String(total));
            res.setHeader('X-Page', String(page));
            res.setHeader('X-Limit', String(limit));
        }
        cache_1.livrosCache.set(cacheKey, { items: resultado, total });
        res.json(resultado);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar livros' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const livro = await connection_1.db.select().from(schema_1.livros)
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(req.params.id)));
        if (!livro.length)
            return res.status(404).json({ erro: 'Livro não encontrado' });
        res.json(livro[0]);
    }
    catch (err) {
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
        const novo = await connection_1.db.insert(schema_1.livros).values({
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
        cache_1.livrosCache.flushAll();
        res.status(201).json(novo[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao adicionar livro' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { titulo, autor, isbn, genero, sinopse, capa, prateleira, totalExemplares, disponiveis } = req.body;
        const atualizado = await connection_1.db.update(schema_1.livros)
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
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(req.params.id)))
            .returning();
        if (!atualizado.length) {
            return res.status(404).json({ erro: 'Livro não encontrado' });
        }
        cache_1.livrosCache.flushAll();
        res.json(atualizado[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao editar livro' });
    }
});
// BUG CORRIGIDO: rota PATCH ausente — app mobile chama PATCH /livros/:id
// para ajustar estoque (handleAjustarEstoque) — retornava 404
router.patch('/:id', async (req, res) => {
    try {
        const { totalExemplares, disponiveis } = req.body;
        const livroAtual = await connection_1.db.select().from(schema_1.livros)
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(req.params.id)));
        if (!livroAtual.length) {
            return res.status(404).json({ erro: 'Livro não encontrado' });
        }
        const atualizado = await connection_1.db.update(schema_1.livros)
            .set({
            ...(totalExemplares !== undefined && { totalExemplares: Number(totalExemplares) }),
            ...(disponiveis !== undefined && { disponiveis: Number(disponiveis) }),
        })
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(req.params.id)))
            .returning();
        cache_1.livrosCache.flushAll();
        res.json(atualizado[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao atualizar livro' });
    }
});
// BUG CORRIGIDO: rota DELETE ausente — app mobile chama DELETE /livros/:id
// em handleRemoverLivro — retornava 404
router.delete('/:id', async (req, res) => {
    try {
        const livroAtual = await connection_1.db.select().from(schema_1.livros)
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(req.params.id)));
        if (!livroAtual.length) {
            return res.status(404).json({ erro: 'Livro não encontrado' });
        }
        if ((livroAtual[0].disponiveis ?? 0) < (livroAtual[0].totalExemplares ?? 0)) {
            return res.status(400).json({
                erro: 'Não é possível remover um livro com exemplares emprestados',
            });
        }
        await connection_1.db.delete(schema_1.livros).where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(req.params.id)));
        cache_1.livrosCache.flushAll();
        res.json({ mensagem: 'Livro removido com sucesso' });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao remover livro' });
    }
});
exports.default = router;
