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
router.post('/', async (req, res) => {
    try {
        const novo = await connection_1.db.insert(schema_1.livros).values(req.body).returning();
        res.status(201).json(novo[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao adicionar livro' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const atualizado = await connection_1.db.update(schema_1.livros)
            .set(req.body)
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(req.params.id)))
            .returning();
        res.json(atualizado[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao editar livro' });
    }
});
exports.default = router;
