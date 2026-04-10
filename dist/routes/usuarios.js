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
// Cadastro principal
router.post('/', async (req, res) => {
    try {
        const { nome, email, senha, matricula, turma, perfil } = req.body;
        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
        }
        // BUG CORRIGIDO: normalizar e-mail para evitar duplicatas por capitalização
        const emailNormalizado = email.toLowerCase().trim();
        const existe = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        if (existe.length > 0) {
            return res.status(400).json({ erro: 'E-mail já cadastrado' });
        }
        const senhaCriptografada = await bcryptjs_1.default.hash(senha, 10);
        const novo = await connection_1.db.insert(schema_1.usuarios).values({
            nome,
            email: emailNormalizado,
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
    catch (err) {
        res.status(500).json({ erro: 'Erro ao criar usuário' });
    }
});
// Alias POST /cadastro → mesmo comportamento que POST /
router.post('/cadastro', async (req, res) => {
    try {
        const { nome, email, senha, matricula, turma, perfil } = req.body;
        if (!nome || !email || !senha) {
            return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
        }
        const emailNormalizado = email.toLowerCase().trim();
        const existe = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        if (existe.length > 0) {
            return res.status(400).json({ erro: 'E-mail já cadastrado' });
        }
        const senhaCriptografada = await bcryptjs_1.default.hash(senha, 10);
        const novo = await connection_1.db.insert(schema_1.usuarios).values({
            nome,
            email: emailNormalizado,
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
// Login
router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        if (!email || !senha) {
            return res.status(400).json({ erro: 'E-mail e senha são obrigatórios' });
        }
        // Normalizar e-mail antes de buscar
        const emailNormalizado = email.toLowerCase().trim();
        const resultado = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
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
// Recuperação de senha — envia código (stub: retorna código diretamente para dev)
router.post('/recuperar-senha', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ erro: 'E-mail é obrigatório' });
        }
        const emailNormalizado = email.toLowerCase().trim();
        const resultado = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        // Retornamos sempre 200 para não revelar se o e-mail existe
        if (resultado.length === 0) {
            return res.json({ mensagem: 'Se o e-mail estiver cadastrado, você receberá o código em breve.' });
        }
        // Gerar código numérico de 6 dígitos
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expira = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
        // TODO: salvar codigo+expira no banco e enviar por e-mail
        // Por ora retorna o código diretamente para ambiente de desenvolvimento
        res.json({
            mensagem: 'Código de recuperação gerado.',
            codigo, // remover em produção quando e-mail estiver configurado
            expiraEm: expira.toISOString(),
        });
    }
    catch {
        res.status(500).json({ erro: 'Erro ao processar recuperação de senha' });
    }
});
// Redefinir senha com código
// BUG CORRIGIDO: rota estava completamente ausente, causando 404 no app
router.post('/redefinir-senha', async (req, res) => {
    try {
        const { email, codigo, novaSenha } = req.body;
        if (!email || !codigo || !novaSenha) {
            return res.status(400).json({ erro: 'E-mail, código e nova senha são obrigatórios' });
        }
        if (novaSenha.length < 6) {
            return res.status(400).json({ erro: 'A nova senha deve ter no mínimo 6 caracteres' });
        }
        const emailNormalizado = email.toLowerCase().trim();
        const resultado = await connection_1.db.select().from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        if (resultado.length === 0) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        // TODO: validar código contra o salvo no banco e verificar expiração
        // Por ora aceita qualquer código para compatibilidade com o stub de recuperação
        const senhaCriptografada = await bcryptjs_1.default.hash(novaSenha, 10);
        await connection_1.db.update(schema_1.usuarios)
            .set({ senha: senhaCriptografada })
            .where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, emailNormalizado));
        res.json({ mensagem: 'Senha redefinida com sucesso' });
    }
    catch {
        res.status(500).json({ erro: 'Erro ao redefinir senha' });
    }
});
// Buscar por e-mail
// BUG CORRIGIDO: select filtrado para não expor hash da senha
router.get('/email/:email', async (req, res) => {
    try {
        const usuario = await connection_1.db.select({
            id: schema_1.usuarios.id,
            nome: schema_1.usuarios.nome,
            email: schema_1.usuarios.email,
            matricula: schema_1.usuarios.matricula,
            turma: schema_1.usuarios.turma,
            perfil: schema_1.usuarios.perfil,
            criadoEm: schema_1.usuarios.criadoEm,
        }).from(schema_1.usuarios).where((0, drizzle_orm_1.eq)(schema_1.usuarios.email, req.params.email));
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
// BUG CORRIGIDO: export default movido para o final do arquivo
// Antes estava no meio — todas as rotas abaixo dele eram código morto
exports.default = router;
