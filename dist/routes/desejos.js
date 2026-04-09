"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { usuarioId } = req.query;
        const rows = await connection_1.db
            .select({
            id: schema_1.desejos.id,
            usuarioId: schema_1.desejos.usuarioId,
            livroId: schema_1.desejos.livroId,
            criadoEm: schema_1.desejos.criadoEm,
            livroTitulo: schema_1.livros.titulo,
            livroAutor: schema_1.livros.autor,
            livroCapa: schema_1.livros.capa,
            livroGenero: schema_1.livros.genero,
            livroDisponiveis: schema_1.livros.disponiveis,
        })
            .from(schema_1.desejos)
            .leftJoin(schema_1.livros, (0, drizzle_orm_1.eq)(schema_1.desejos.livroId, schema_1.livros.id));
        const filtered = usuarioId
            ? rows.filter((r) => String(r.usuarioId) === String(usuarioId))
            : rows;
        res.json(filtered);
    }
    catch {
        res.status(500).json({ erro: 'Erro ao buscar desejos' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { usuarioId, livroId } = req.body;
        if (!usuarioId || !livroId) {
            return res.status(400).json({ erro: 'usuarioId e livroId são obrigatórios' });
        }
        const existente = await connection_1.db
            .select()
            .from(schema_1.desejos)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.desejos.usuarioId, Number(usuarioId)), (0, drizzle_orm_1.eq)(schema_1.desejos.livroId, Number(livroId))));
        if (existente.length > 0) {
            // já existe -> remove (toggle)
            await connection_1.db.delete(schema_1.desejos).where((0, drizzle_orm_1.eq)(schema_1.desejos.id, existente[0].id));
            return res.json({ removido: true });
        }
        const novo = await connection_1.db
            .insert(schema_1.desejos)
            .values({ usuarioId: Number(usuarioId), livroId: Number(livroId) })
            .returning();
        res.status(201).json(novo[0]);
    }
    catch {
        res.status(500).json({ erro: 'Erro ao salvar desejo' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await connection_1.db.delete(schema_1.desejos).where((0, drizzle_orm_1.eq)(schema_1.desejos.id, Number(req.params.id)));
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ erro: 'Erro ao remover desejo' });
    }
});
exports.default = router;
