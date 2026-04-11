"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const todos = await connection_1.db.select().from(schema_1.comunicados)
            .orderBy(schema_1.comunicados.criadoEm);
        res.json(todos.reverse());
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar comunicados' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { titulo, mensagem, autor, destinatario } = req.body;
        if (!titulo || !mensagem) {
            return res.status(400).json({ erro: 'Título e mensagem são obrigatórios' });
        }
        const novo = await connection_1.db.insert(schema_1.comunicados).values({
            titulo, mensagem, autor, destinatario: destinatario || 'todos',
        }).returning();
        res.status(201).json(novo[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao criar comunicado' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await connection_1.db.delete(schema_1.comunicados)
            .where((0, drizzle_orm_1.eq)(schema_1.comunicados.id, Number(req.params.id)));
        res.json({ mensagem: 'Comunicado removido' });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao remover comunicado' });
    }
});
exports.default = router;
