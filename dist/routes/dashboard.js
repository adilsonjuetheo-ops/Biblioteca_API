"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const connection_1 = require("../db/connection");
const connection_2 = require("../db/connection");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const emprestimos_1 = require("./emprestimos");
const cache_1 = require("../cache");
const router = (0, express_1.Router)();
// GET /dashboard — carrega todos os dados do app em uma única chamada
router.get('/', async (req, res) => {
    const t0 = Date.now();
    try {
        const uid = req.usuarioAutenticado?.id;
        const perfil = req.usuarioAutenticado?.perfil;
        const isBiblio = !!perfil && !['aluno', 'professor'].includes(perfil);
        // Dados compartilhados: mesmos para todos os usuários — 1 query a cada 30s no banco
        let shared = cache_1.dashboardCache.get('dash:shared');
        if (!shared) {
            const [todosEmprestimos, todosLivros, todasAvaliacoes, todosComunicados, suspensoeResult] = await Promise.all([
                connection_1.db.select({
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
                    .leftJoin(schema_1.usuarios, (0, drizzle_orm_1.eq)(schema_1.emprestimos.usuarioId, schema_1.usuarios.id)),
                connection_1.db.select({
                    id: schema_1.livros.id,
                    titulo: schema_1.livros.titulo,
                    autor: schema_1.livros.autor,
                    isbn: schema_1.livros.isbn,
                    genero: schema_1.livros.genero,
                    capa: schema_1.livros.capa,
                    prateleira: schema_1.livros.prateleira,
                    totalExemplares: schema_1.livros.totalExemplares,
                    disponiveis: schema_1.livros.disponiveis,
                }).from(schema_1.livros),
                connection_1.db.select().from(schema_1.avaliacoes),
                connection_1.db.select().from(schema_1.comunicados).orderBy(schema_1.comunicados.criadoEm),
                connection_2.pool.query(`
          SELECT s.*, u.nome as usuario_nome, u.email as usuario_email,
                 u.turma as usuario_turma, e.livro_id,
                 l.titulo as livro_titulo
          FROM suspensoes s
          LEFT JOIN usuarios u ON s.usuario_id = u.id
          LEFT JOIN emprestimos e ON s.emprestimo_id = e.id
          LEFT JOIN livros l ON e.livro_id = l.id
          WHERE s.expira_em > NOW()
          ORDER BY s.criado_em DESC
        `),
            ]);
            shared = {
                livros: todosLivros,
                emprestimos: todosEmprestimos.map(e => ({ ...e, status: (0, emprestimos_1.calcularStatus)(e) })),
                avaliacoes: todasAvaliacoes,
                comunicados: [...todosComunicados].reverse(),
                suspensoes: suspensoeResult.rows,
            };
            cache_1.dashboardCache.set('dash:shared', shared);
            console.log(`[dashboard] db query — ${Date.now() - t0}ms`);
        }
        else {
            console.log(`[dashboard] cache hit — ${Date.now() - t0}ms`);
        }
        // Dados por usuário: apenas desejos (query pequena) e lista de usuários para biblitecário
        const [todosDesejos, todosUsuarios] = await Promise.all([
            uid ? connection_1.db.select().from(schema_1.desejos).where((0, drizzle_orm_1.eq)(schema_1.desejos.usuarioId, Number(uid))) : Promise.resolve([]),
            isBiblio
                ? (cache_1.dashboardCache.get('dash:usuarios') ?? connection_1.db.select({
                    id: schema_1.usuarios.id,
                    nome: schema_1.usuarios.nome,
                    email: schema_1.usuarios.email,
                    matricula: schema_1.usuarios.matricula,
                    turma: schema_1.usuarios.turma,
                    perfil: schema_1.usuarios.perfil,
                }).from(schema_1.usuarios).then(r => { cache_1.dashboardCache.set('dash:usuarios', r); return r; }))
                : Promise.resolve([]),
        ]);
        res.json({ ...shared, desejos: todosDesejos, usuarios: todosUsuarios });
    }
    catch (err) {
        console.error('[dashboard]', err);
        res.status(500).json({ erro: 'Erro ao carregar dashboard' });
    }
});
// GET /dashboard/resumo — estatísticas para o painel admin
router.get('/resumo', async (_req, res) => {
    try {
        const cached = cache_1.dashboardCache.get('resumo');
        if (cached)
            return res.json(cached);
        const [totalLivros, livrosDisponiveis, emprestimosAtivos, emprestimosAtrasados, emprestimosDevolvidos, ultimosEmprestimos, livrosMaisEmprestados,] = await Promise.all([
            connection_2.pool.query('SELECT COUNT(*)::int AS total FROM livros'),
            connection_2.pool.query('SELECT COUNT(*)::int AS total FROM livros WHERE COALESCE(disponiveis, 0) > 0'),
            connection_2.pool.query("SELECT COUNT(*)::int AS total FROM emprestimos WHERE status IN ('reservado', 'retirado')"),
            connection_2.pool.query("SELECT COUNT(*)::int AS total FROM emprestimos WHERE status = 'retirado' AND data_devolucao < NOW()"),
            connection_2.pool.query("SELECT COUNT(*)::int AS total FROM emprestimos WHERE status = 'devolvido'"),
            connection_2.pool.query(`
        SELECT
          e.id,
          CASE
            WHEN e.status = 'devolvido' THEN 'devolvido'
            WHEN e.status = 'retirado' AND e.data_devolucao < NOW() THEN 'atrasado'
            ELSE e.status
          END AS status,
          e.data_reserva,
          e.data_retirada,
          e.data_devolucao,
          l.titulo AS "livroTitulo",
          l.autor AS "livroAutor",
          u.nome AS "usuarioNome"
        FROM emprestimos e
        LEFT JOIN livros l ON l.id = e.livro_id
        LEFT JOIN usuarios u ON u.id = e.usuario_id
        ORDER BY COALESCE(e.data_retirada, e.data_reserva, e.criado_em) DESC, e.id DESC
        LIMIT 5
      `),
            connection_2.pool.query(`
        SELECT
          l.id,
          l.titulo,
          COUNT(e.id)::int AS total
        FROM emprestimos e
        INNER JOIN livros l ON l.id = e.livro_id
        GROUP BY l.id, l.titulo
        ORDER BY total DESC, l.titulo ASC
        LIMIT 5
      `),
        ]);
        const resultado = {
            resumo: {
                totalLivros: totalLivros.rows[0]?.total || 0,
                livrosDisponiveis: livrosDisponiveis.rows[0]?.total || 0,
                emprestimosAtivos: emprestimosAtivos.rows[0]?.total || 0,
                emprestimosAtrasados: emprestimosAtrasados.rows[0]?.total || 0,
                emprestimosDevolvidos: emprestimosDevolvidos.rows[0]?.total || 0,
            },
            ultimosEmprestimos: ultimosEmprestimos.rows,
            livrosMaisEmprestados: livrosMaisEmprestados.rows,
        };
        cache_1.dashboardCache.set('resumo', resultado);
        res.json(resultado);
    }
    catch (err) {
        res.status(500).json({ erro: 'Erro ao carregar resumo do dashboard' });
    }
});
exports.default = router;
