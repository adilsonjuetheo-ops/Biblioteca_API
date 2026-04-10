"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const todos = await connection_1.db.select().from(schema_1.livros);
        res.json(todos);
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
        const { titulo, autor, genero, sinopse, capa, totalExemplares } = req.body;
        if (!titulo || !titulo.trim()) {
            return res.status(400).json({ erro: 'Título é obrigatório' });
        }
        const total = Number(totalExemplares) || 1;
        const novo = await connection_1.db.insert(schema_1.livros).values({
            titulo: titulo.trim(),
            autor: autor?.trim() || null,
            genero: genero?.trim() || null,
            sinopse: sinopse?.trim() || null,
            capa: capa?.trim() || null,
            totalExemplares: total,
            disponiveis: total,
        }).returning();
        res.status(201).json(novo[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao adicionar livro' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { titulo, autor, genero, sinopse, capa, totalExemplares, disponiveis } = req.body;
        const atualizado = await connection_1.db.update(schema_1.livros)
            .set({
            titulo: titulo?.trim(),
            autor: autor?.trim() || null,
            genero: genero?.trim() || null,
            sinopse: sinopse?.trim() || null,
            capa: capa?.trim() || null,
            totalExemplares: totalExemplares !== undefined ? Number(totalExemplares) : undefined,
            disponiveis: disponiveis !== undefined ? Number(disponiveis) : undefined,
        })
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(req.params.id)))
            .returning();
        if (!atualizado.length) {
            return res.status(404).json({ erro: 'Livro não encontrado' });
        }
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
        res.json({ mensagem: 'Livro removido com sucesso' });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao remover livro' });
    }
});
exports.default = router;
