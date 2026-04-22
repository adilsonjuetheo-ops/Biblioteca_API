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
const auth_1 = require("../middleware/auth");
const cache_1 = require("../cache");
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
const statusCalculadoSql = (0, drizzle_orm_1.sql) `
  CASE
    WHEN ${schema_1.emprestimos.status} = 'devolvido' THEN 'devolvido'
    WHEN ${schema_1.emprestimos.status} = 'retirado' AND ${schema_1.emprestimos.dataDevolucao} < NOW() THEN 'atrasado'
    ELSE ${schema_1.emprestimos.status}
  END
`;
async function buscarEmprestimoDetalhado(id) {
    const rows = await connection_1.db
        .select({
        id: schema_1.emprestimos.id,
        usuarioId: schema_1.emprestimos.usuarioId,
        livroId: schema_1.emprestimos.livroId,
        status: statusCalculadoSql,
        dataReserva: schema_1.emprestimos.dataReserva,
        dataRetirada: schema_1.emprestimos.dataRetirada,
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
        .leftJoin(schema_1.usuarios, (0, drizzle_orm_1.eq)(schema_1.emprestimos.usuarioId, schema_1.usuarios.id))
        .where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, id));
    return rows[0] || null;
}
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(200, Math.max(0, Number(req.query.limit) || 0));
        const busca = String(req.query.search || '').trim();
        const status = String(req.query.status || '').trim();
        const usuarioId = Number(req.query.usuarioId) || 0;
        const turma = String(req.query.turma || '').trim();
        const livroId = Number(req.query.livroId) || 0;
        const filtros = [];
        if (usuarioId > 0)
            filtros.push((0, drizzle_orm_1.eq)(schema_1.emprestimos.usuarioId, usuarioId));
        if (livroId > 0)
            filtros.push((0, drizzle_orm_1.eq)(schema_1.emprestimos.livroId, livroId));
        if (turma)
            filtros.push((0, drizzle_orm_1.eq)(schema_1.usuarios.turma, turma));
        if (busca) {
            filtros.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.ilike)(schema_1.usuarios.nome, `%${busca}%`), (0, drizzle_orm_1.ilike)(schema_1.usuarios.matricula, `%${busca}%`), (0, drizzle_orm_1.ilike)(schema_1.livros.titulo, `%${busca}%`), (0, drizzle_orm_1.ilike)(schema_1.livros.autor, `%${busca}%`)));
        }
        if (status && status !== 'todos') {
            filtros.push((0, drizzle_orm_1.sql) `${statusCalculadoSql} = ${status}`);
        }
        const whereClause = filtros.length ? (0, drizzle_orm_1.and)(...filtros) : undefined;
        let query = connection_1.db
            .select({
            id: schema_1.emprestimos.id,
            usuarioId: schema_1.emprestimos.usuarioId,
            livroId: schema_1.emprestimos.livroId,
            status: statusCalculadoSql,
            dataReserva: schema_1.emprestimos.dataReserva,
            dataRetirada: schema_1.emprestimos.dataRetirada,
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
            .leftJoin(schema_1.usuarios, (0, drizzle_orm_1.eq)(schema_1.emprestimos.usuarioId, schema_1.usuarios.id))
            .$dynamic();
        if (whereClause)
            query = query.where(whereClause);
        query = query.orderBy((0, drizzle_orm_1.desc)(schema_1.emprestimos.dataReserva), (0, drizzle_orm_1.desc)(schema_1.emprestimos.id));
        const todos = limit > 0
            ? await query.limit(limit).offset((page - 1) * limit)
            : await query;
        if (limit > 0) {
            let totalQuery = connection_1.db.select({ total: (0, drizzle_orm_1.count)() }).from(schema_1.emprestimos)
                .leftJoin(schema_1.livros, (0, drizzle_orm_1.eq)(schema_1.emprestimos.livroId, schema_1.livros.id))
                .leftJoin(schema_1.usuarios, (0, drizzle_orm_1.eq)(schema_1.emprestimos.usuarioId, schema_1.usuarios.id))
                .$dynamic();
            if (whereClause)
                totalQuery = totalQuery.where(whereClause);
            const totalRows = await totalQuery;
            res.setHeader('X-Total-Count', String(totalRows[0]?.total || 0));
            res.setHeader('X-Page', String(page));
            res.setHeader('X-Limit', String(limit));
        }
        res.json(todos);
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
        const resultadoLivro = await connection_1.db.select({
            id: schema_1.livros.id,
            disponiveis: schema_1.livros.disponiveis,
        }).from(schema_1.livros).where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(livroId)));
        if (!resultadoLivro.length) {
            return res.status(404).json({ erro: 'Livro não encontrado' });
        }
        if ((resultadoLivro[0].disponiveis || 0) <= 0) {
            return res.status(400).json({ erro: 'Não há exemplares disponíveis para reserva' });
        }
        const novo = await connection_1.db.insert(schema_1.emprestimos)
            .values({ usuarioId, livroId, status: 'reservado' })
            .returning({ id: schema_1.emprestimos.id });
        await connection_1.db.update(schema_1.livros)
            .set({ disponiveis: (0, drizzle_orm_1.sql) `GREATEST(${schema_1.livros.disponiveis} - 1, 0)` })
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, Number(livroId)));
        cache_1.livrosCache.flushAll();
        const detalhado = await buscarEmprestimoDetalhado(novo[0].id);
        res.status(201).json(detalhado);
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
        cache_1.livrosCache.flushAll();
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
        cache_1.livrosCache.flushAll();
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
        const id = Number(req.params.id);
        const atual = await connection_1.db.select().from(schema_1.emprestimos).where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, id));
        if (!atual.length) {
            return res.status(404).json({ erro: 'Empréstimo não encontrado' });
        }
        const emp = await connection_1.db.update(schema_1.emprestimos)
            .set({ status: 'devolvido', dataDevolucao: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, id))
            .returning();
        await connection_1.db.update(schema_1.livros)
            .set({ disponiveis: (0, drizzle_orm_1.sql) `LEAST(${schema_1.livros.disponiveis} + 1, ${schema_1.livros.totalExemplares})` })
            .where((0, drizzle_orm_1.eq)(schema_1.livros.id, emp[0].livroId));
        cache_1.livrosCache.flushAll();
        const detalhado = await buscarEmprestimoDetalhado(id);
        res.json(detalhado);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao registrar devolução' });
    }
});
router.patch('/:id/retirar', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const dataDevolucao = new Date();
        dataDevolucao.setDate(dataDevolucao.getDate() + 8);
        const emp = await connection_1.db.update(schema_1.emprestimos)
            .set({ status: 'retirado', dataRetirada: new Date(), dataDevolucao })
            .where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, id))
            .returning();
        if (!emp.length) {
            return res.status(404).json({ erro: 'Empréstimo não encontrado' });
        }
        const detalhado = await buscarEmprestimoDetalhado(id);
        res.json(detalhado);
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
        const detalhado = await buscarEmprestimoDetalhado(atualizado[0].id);
        res.json(detalhado);
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
router.delete('/:id', auth_1.autenticarBibliotecario, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const resultado = await connection_1.db.select().from(schema_1.emprestimos).where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, id));
        if (!resultado.length) {
            return res.status(404).json({ erro: 'Empréstimo não encontrado' });
        }
        const emp = resultado[0];
        const status = calcularStatus(emp);
        if (['reservado', 'retirado', 'atrasado'].includes(status)) {
            await connection_1.db.update(schema_1.livros)
                .set({ disponiveis: (0, drizzle_orm_1.sql) `LEAST(${schema_1.livros.disponiveis} + 1, ${schema_1.livros.totalExemplares})` })
                .where((0, drizzle_orm_1.eq)(schema_1.livros.id, emp.livroId));
        }
        await connection_1.db.delete(schema_1.emprestimos).where((0, drizzle_orm_1.eq)(schema_1.emprestimos.id, id));
        cache_1.livrosCache.flushAll();
        res.json({ mensagem: 'Empréstimo excluído com sucesso', id });
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao excluir empréstimo' });
    }
});
exports.default = router;
