"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const connection_2 = require("../db/connection");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
// Helpers
function calcularStatus(emp) {
    if (emp.status === 'devolvido')
        return 'devolvido';
    if (emp.status === 'retirado' && emp.dataDevolucao) {
        const vencimento = new Date(emp.dataDevolucao);
        if (vencimento < new Date())
            return 'atrasado';
    }
    return emp.status;
}
router.get('/', async (req, res) => {
    try {
        const todos = await connection_1.db
            .select({
            id: schema_1.emprestimos.id,
            usuarioId: schema_1.emprestimos.usuarioId,
            livroId: schema_1.emprestimos.livroId,
            status: schema_1.emprestimos.status,
            dataReserva: schema_1.emprestimos.dataReserva,
            dataDevolucao: schema_1.emprestimos.dataDevolucao,
            renovado: schema_1.emprestimos.renovado,
            livroTitulo: schema_1.livros.titulo,
            livroAutor: schema_1.livros.autor,
            livroGenero: schema_1.livros.genero,
            livroCapa: schema_1.livros.capa,
            usuarioNome: schema_1.usuarios.nome,
            usuarioTurma: schema_1.usuarios.turma,
            usuarioMatricula: schema_1.usuarios.matricula,
        })
            .from(schema_1.emprestimos)
            .leftJoin(schema_1.livros, (0, drizzle_orm_1.eq)(schema_1.emprestimos.livroId, schema_1.livros.id))
            .leftJoin(schema_1.usuarios, (0, drizzle_orm_1.eq)(schema_1.emprestimos.usuarioId, schema_1.usuarios.id));
        const comStatusCalculado = todos.map(emp => ({
            ...emp,
            status: calcularStatus(emp),
        }));
        res.json(comStatusCalculado);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao buscar empréstimos' });
    }
});
router.post('/', async (req, res) => {
    try {
        const { livroId } = req.body;
        // usuarioId sempre vem do token — nunca do body
        const usuarioId = req.usuarioAutenticado?.id;
        if (!usuarioId)
            return res.status(401).json({ erro: 'Usuário não autenticado' });
        if (!livroId)
            return res.status(400).json({ erro: 'livroId é obrigatório' });
        const novo = await connection_1.db.insert(schema_1.emprestimos)
            .values({ usuarioId, livroId, status: 'reservado' })
            .returning();
        await connection_1.db.update(schema_1.livros)
            .set({ disponiveis: (0, drizzle_orm_1.sql) `${schema_1.livros.disponiveis} - 1` })
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, livroId));
        res.status(201).json(novo[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao criar reserva' });
    }
});
// Reparo: remove empréstimos sem usuário (usuarioId NULL) e restaura exemplares
router.post('/reparar-orfaos', async (req, res) => {
    if (req.usuarioAutenticado?.perfil !== 'bibliotecario') {
        return res.status(403).json({ erro: 'Acesso restrito ao bibliotecário' });
    }
    try {
        // Busca empréstimos órfãos
        const orfaos = await connection_2.pool.query(`SELECT id, livro_id, status FROM emprestimos WHERE usuario_id IS NULL`);
        if (orfaos.rows.length === 0) {
            return res.json({ reparados: 0, mensagem: 'Nenhum empréstimo órfão encontrado.' });
        }
        // Restaura exemplares dos ativos/retirados
        for (const emp of orfaos.rows) {
            if (emp.status === 'reservado' || emp.status === 'retirado') {
                await connection_2.pool.query(`UPDATE livros SET disponiveis = LEAST(disponiveis + 1, total_exemplares) WHERE id = $1`, [emp.livro_id]);
            }
        }
        // Remove os órfãos
        await connection_2.pool.query(`DELETE FROM emprestimos WHERE usuario_id IS NULL`);
        res.json({
            reparados: orfaos.rows.length,
            mensagem: `${orfaos.rows.length} empréstimo(s) sem dono removido(s) e exemplares devolvidos ao acervo.`,
        });
    }
    catch (err) {
        console.error('[reparar-orfaos]', err);
        res.status(500).json({ erro: 'Erro ao reparar empréstimos' });
    }
});
// ── IMPORTANTE: /retirada-qr ANTES das rotas /:id ──
router.patch('/retirada-qr', async (req, res) => {
    console.log('[retirada-qr] handler chamado, body:', req.body);
    try {
        const { codigo } = req.body;
        if (!codigo)
            return res.status(400).json({ erro: 'codigo é obrigatório' });
        const result = await connection_2.pool.query(`SELECT e.*, l.titulo as livro_titulo, l.autor as livro_autor, u.nome as usuario_nome, u.turma as usuario_turma
       FROM emprestimos e
       LEFT JOIN livros l ON e.livro_id = l.id
       LEFT JOIN usuarios u ON e.usuario_id = u.id
       WHERE e.retirada_qr_codigo = $1
         AND e.status = 'reservado'`, [codigo.trim().toUpperCase()]);
        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'QR inválido, expirado ou já utilizado' });
        }
        const emp = result.rows[0];
        if (emp.retirada_qr_expira_em && new Date(emp.retirada_qr_expira_em) < new Date()) {
            await connection_2.pool.query(`UPDATE emprestimos SET retirada_qr_codigo = NULL WHERE id = $1`, [emp.id]);
            return res.status(410).json({ erro: 'QR expirado' });
        }
        const dataDevolucao = new Date();
        dataDevolucao.setDate(dataDevolucao.getDate() + 8);
        await connection_2.pool.query(`UPDATE emprestimos
       SET status = 'retirado',
           data_retirada = NOW(),
           data_devolucao = $2,
           retirada_qr_usado_em = NOW(),
           retirada_qr_codigo = NULL
       WHERE id = $1`, [emp.id, dataDevolucao]);
        res.json({
            ok: true,
            emprestimo: {
                id: emp.id,
                livroTitulo: emp.livro_titulo,
                livroAutor: emp.livro_autor,
                usuarioNome: emp.usuario_nome,
                usuarioTurma: emp.usuario_turma,
                status: 'retirado',
                dataDevolucao: dataDevolucao.toISOString(),
            },
        });
    }
    catch (err) {
        console.log('[retirada-qr] erro:', err);
        res.status(500).json({ erro: 'Erro ao processar QR de retirada' });
    }
});
router.patch('/:id/devolver', async (req, res) => {
    try {
        const emp = await connection_1.db.update(schema_1.emprestimos)
            .set({ status: 'devolvido', dataDevolucao: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, Number(req.params.id)))
            .returning();
        await connection_1.db.update(schema_1.livros)
            .set({ disponiveis: (0, drizzle_orm_1.sql) `${schema_1.livros.disponiveis} + 1` })
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, emp[0].livroId));
        res.json(emp[0]);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao registrar devolução' });
    }
});
router.patch('/:id/retirar', async (req, res) => {
    try {
        const dataDevolucao = new Date();
        dataDevolucao.setDate(dataDevolucao.getDate() + 8);
        const emp = await connection_1.db.update(schema_1.emprestimos)
            .set({ status: 'retirado', dataRetirada: new Date(), dataDevolucao })
            .where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, Number(req.params.id)))
            .returning();
        res.json({ ...emp[0], status: calcularStatus(emp[0]) });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao registrar retirada' });
    }
});
router.patch('/:id/renovar', async (req, res) => {
    try {
        const resultado = await connection_1.db.select().from(schema_1.emprestimos)
            .where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, Number(req.params.id)));
        if (!resultado.length) {
            return res.status(404).json({ erro: 'Empréstimo não encontrado' });
        }
        const emp = resultado[0];
        if (emp.renovado) {
            return res.status(400).json({ erro: 'Este empréstimo já foi renovado uma vez' });
        }
        if (emp.status !== 'retirado') {
            return res.status(400).json({ erro: 'Só é possível renovar empréstimos com livro retirado' });
        }
        const novaData = new Date();
        novaData.setDate(novaData.getDate() + 5);
        const atualizado = await connection_1.db.update(schema_1.emprestimos)
            .set({ renovado: true, dataDevolucao: novaData })
            .where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, Number(req.params.id)))
            .returning();
        res.json({ ...atualizado[0], status: calcularStatus(atualizado[0]) });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao renovar empréstimo' });
    }
});
router.post('/:id/qr-retirada', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const emp = await connection_1.db.select().from(schema_1.emprestimos).where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, id));
        if (!emp.length)
            return res.status(404).json({ erro: 'Empréstimo não encontrado' });
        if (emp[0].status !== 'reservado')
            return res.status(400).json({ erro: 'Empréstimo não está no status reservado' });
        const codigo = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
        const payload = `BIBLIO:${id}:${codigo}`;
        const expira = new Date(Date.now() + 15 * 60 * 1000);
        await connection_2.pool.query(`UPDATE emprestimos
       SET retirada_qr_codigo = $1,
           retirada_qr_payload = $2,
           retirada_qr_gerado_em = NOW(),
           retirada_qr_expira_em = $3,
           retirada_qr_usado_em = NULL
       WHERE id = $4`, [codigo, payload, expira, id]);
        res.json({ codigo, payload, expiraEm: expira.toISOString() });
    }
    catch {
        res.status(500).json({ erro: 'Erro ao gerar QR de retirada' });
    }
});
exports.default = router;
