"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const cache_1 = require("../cache");
async function enviarPushComunicado(titulo, mensagem, destinatario) {
    try {
        const perfilPorDestinatario = {
            alunos: 'aluno',
            professores: 'professor',
        };
        const perfil = perfilPorDestinatario[destinatario] ?? null;
        const filtro = perfil
            ? (0, drizzle_orm_1.and)((0, drizzle_orm_1.isNotNull)(schema_1.usuarios.pushToken), (0, drizzle_orm_1.eq)(schema_1.usuarios.perfil, perfil))
            : (0, drizzle_orm_1.isNotNull)(schema_1.usuarios.pushToken);
        const comToken = await connection_1.db.select({ pushToken: schema_1.usuarios.pushToken })
            .from(schema_1.usuarios)
            .where(filtro);
        if (!comToken.length)
            return;
        const mensagens = comToken.map(u => ({
            to: u.pushToken,
            title: titulo,
            body: mensagem,
            sound: 'default',
        }));
        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(mensagens),
        });
    }
    catch (err) {
        console.error('[push] erro ao enviar notificações:', err);
    }
}
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const cached = cache_1.comunicadosCache.get('lista');
        if (cached)
            return res.json(cached);
        const todos = await connection_1.db.select().from(schema_1.comunicados)
            .orderBy(schema_1.comunicados.criadoEm);
        const resultado = todos.reverse();
        cache_1.comunicadosCache.set('lista', resultado);
        res.json(resultado);
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
        cache_1.comunicadosCache.flushAll();
        enviarPushComunicado(titulo, mensagem, destinatario || 'todos');
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
        cache_1.comunicadosCache.flushAll();
        res.json({ mensagem: 'Comunicado removido' });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao remover comunicado' });
    }
});
exports.default = router;
