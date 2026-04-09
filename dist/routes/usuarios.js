"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const router = (0, express_1.Router)();
// Listar usuários
router.get('/', async (req, res) => {
    try {
        const todos = await connection_1.db.select({
            id: schema_1.usuarios.id,
            nome: schema_1.usuarios.nome,
            email: schema_1.usuarios.email,
            matricula: schema_1.usuarios.matricula,
            turma: schema_1.usuarios.turma,
            perfil: schema_1.usuarios.perfil,
            criadoEm: schema_1.usuarios.criadoEm,
        }).from(schema_1.usuarios);
        res.json(todos);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar usuários' });
    }
});
// Cadastro
router.post('/', async (req, res) => {
    try {
        const { nome, email, senha, matricula, turma, perfil } = req.body;
        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
        }
        const existe = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, email));
        if (existe.length > 0) {
            return res.status(400).json({ erro: 'E-mail já cadastrado' });
        }
        const senhaCriptografada = await bcryptjs_1.default.hash(senha, 10);
        const novo = await connection_1.db.insert(schema_1.usuarios).values({
            nome, email, senha: senhaCriptografada,
            matricula, turma, perfil: perfil || 'aluno',
        }).returning({
            id: schema_1.usuarios.id,
            nome: schema_1.usuarios.nome,
            email: schema_1.usuarios.email,
            perfil: schema_1.usuarios.perfil,
        });
        res.status(201).json(novo[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao criar usuário' });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios' });
        }
        const resultado = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, email));
        if (resultado.length === 0) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }
        const usuario = resultado[0];
        const senhaCorreta = await bcryptjs_1.default.compare(senha, usuario.senha);
        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
        }
        res.json({
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            matricula: usuario.matricula,
            turma: usuario.turma,
            perfil: usuario.perfil,
        });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao fazer login' });
    }
});
// Buscar por email
router.get('/email/:email', async (req, res) => {
    try {
        const usuario = await connection_1.db.select().from(schema_1.usuarios)
            .where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, req.params.email));
        if (!usuario.length)
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        res.json(usuario[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar usuário' });
    }
});
// Deletar usuário
router.delete('/:id', async (req, res) => {
    try {
        await connection_1.db.delete(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.id, Number(req.params.id)));
        res.json({ mensagem: 'Usuário removido com sucesso' });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao remover usuário' });
    }
});
exports.default = router;
// Alias: POST /cadastro → same as POST /
router.post('/cadastro', async (req, res) => {
    try {
        const { nome, email, senha, matricula, turma, perfil } = req.body;
        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
        }
        const existe = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, email.toLowerCase().trim()));
        if (existe.length > 0) {
            return res.status(400).json({ erro: 'E-mail já cadastrado' });
        }
        const senhaCriptografada = await bcryptjs_1.default.hash(senha, 10);
        const novo = await connection_1.db.insert(schema_1.usuarios).values({
            nome,
            email: email.toLowerCase().trim(),
            senha: senhaCriptografada,
            matricula,
            turma,
            perfil: perfil || 'aluno',
        }).returning({
            id: schema_1.usuarios.id,
            nome: schema_1.usuarios.nome,
            email: schema_1.usuarios.email,
            perfil: schema_1.usuarios.perfil,
            matricula: schema_1.usuarios.matricula,
            turma: schema_1.usuarios.turma,
        });
        res.status(201).json(novo[0]);
    }
    catch {
        res.status(500).json({ erro: 'Erro ao criar usuário' });
    }
});
// Stub: recuperação de senha (não implementada com e-mail)
router.post('/recuperar-senha', (_req, res) => {
    res.status(503).json({ erro: 'Recuperação por e-mail não disponível neste momento.' });
});
router.post('/recuperar-senha/verificar', (_req, res) => {
    res.status(503).json({ erro: 'Recuperação por e-mail não disponível neste momento.' });
});
