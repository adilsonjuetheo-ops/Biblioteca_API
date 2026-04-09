"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const { usuarioId, livroId } = req.query;
        let query = connection_1.db
            .select({
            id: schema_1.avaliacoes.id,
            usuarioId: schema_1.avaliacoes.usuarioId,
            livroId: schema_1.avaliacoes.livroId,
            nota: schema_1.avaliacoes.nota,
            texto: schema_1.avaliacoes.texto,
            criadoEm: schema_1.avaliacoes.criadoEm,
            usuarioNome: schema_1.usuarios.nome,
            livroTitulo: schema_1.livros.titulo,
        })
            .from(schema_1.avaliacoes)
            .leftJoin(schema_1.usuarios, (0, drizzle_orm_1.eq)(schema_1.avaliacoes.usuarioId, schema_1.usuarios.id))
            .leftJoin(schema_1.livros, (0, drizzle_orm_1.eq)(schema_1.avaliacoes.livroId, schema_1.livros.id));
        const rows = await query;
        const filtered = rows.filter((r) => {
            if (usuarioId && String(r.usuarioId) !== String(usuarioId))
                return false;
            if (livroId && String(r.livroId) !== String(livroId))
                return false;
            return true;
        });
        res.json(filtered);
    }
    catch {
        res.status(500).json({ erro: 'Erro ao buscar avaliações' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { usuarioId, livroId, nota, texto } = req.body;
        if (!usuarioId || !livroId) {
            return res.status(400).json({ erro: 'usuarioId e livroId são obrigatórios' });
        }
        const existente = await connection_1.db
            .select()
            .from(schema_1.avaliacoes)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.avaliacoes.usuarioId, Number(usuarioId)), (0, drizzle_orm_1.eq)(schema_1.avaliacoes.livroId, Number(livroId))));
        if (existente.length > 0) {
            const atualizado = await connection_1.db
                .update(schema_1.avaliacoes)
                .set({ nota: Number(nota), texto: String(texto || '') })
                .where((0, drizzle_orm_1.eq)(schema_1.avaliacoes.id, existente[0].id))
                .returning();
            return res.json(atualizado[0]);
        }
        const nova = await connection_1.db
            .insert(schema_1.avaliacoes)
            .values({ usuarioId: Number(usuarioId), livroId: Number(livroId), nota: Number(nota), texto: String(texto || '') })
            .returning();
        res.status(201).json(nova[0]);
    }
    catch {
        res.status(500).json({ erro: 'Erro ao salvar avaliação' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await connection_1.db.delete(schema_1.avaliacoes).where((0, drizzle_orm_1.eq)(schema_1.avaliacoes.id, Number(req.params.id)));
        res.json({ ok: true });
    }
    catch {
        res.status(500).json({ erro: 'Erro ao remover avaliação' });
    }
});
exports.default = router;
