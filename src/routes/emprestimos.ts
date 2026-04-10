import { Router } from 'express';
import { db } from '../db/connection';
import { emprestimos, livros, usuarios } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { pool } from '../db/connection';
import crypto from 'crypto';

const router = Router();

// Helpers
function calcularStatus(emp: {
  status: string;
  dataDevolucao?: Date | string | null;
}): string {
  if (emp.status === 'devolvido') return 'devolvido';
  if (emp.status === 'retirado' && emp.dataDevolucao) {
    const vencimento = new Date(emp.dataDevolucao);
    if (vencimento < new Date()) return 'atrasado';
  }
  return emp.status;
}

router.get('/', async (req, res) => {
  try {
    const todos = await db
      .select({
        id: emprestimos.id,
        usuarioId: emprestimos.usuarioId,
        livroId: emprestimos.livroId,
        status: emprestimos.status,
        dataReserva: emprestimos.dataReserva,
        dataDevolucao: emprestimos.dataDevolucao,
        renovado: emprestimos.renovado,
        livroTitulo: livros.titulo,
        livroAutor: livros.autor,
        livroGenero: livros.genero,
        livroCapa: livros.capa,
        usuarioNome: usuarios.nome,
        usuarioTurma: usuarios.turma,
        usuarioMatricula: usuarios.matricula,
      })
      .from(emprestimos)
      .leftJoin(livros, eq(emprestimos.livroId, livros.id))
      .leftJoin(usuarios, eq(emprestimos.usuarioId, usuarios.id));

    // BUG CORRIGIDO: status 'atrasado' calculado dinamicamente
    // A API nunca setava esse status — empréstimos vencidos ficavam como 'retirado'
    // e o card "Em atraso" do painel admin sempre mostrava zero
    const comStatusCalculado = todos.map(emp => ({
      ...emp,
      status: calcularStatus(emp),
    }));

    res.json(comStatusCalculado);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar empréstimos' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { usuarioId, livroId } = req.body;
    const novo = await db.insert(emprestimos)
      .values({ usuarioId, livroId, status: 'reservado' })
      .returning();
    await db.update(livros)
      .set({ disponiveis: sql`${livros.disponiveis} - 1` })
      .where(eq(livros.id, livroId));
    res.status(201).json(novo[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar reserva' });
  }
});

router.patch('/:id/devolver', async (req, res) => {
  try {
    const emp = await db.update(emprestimos)
      .set({ status: 'devolvido', dataDevolucao: new Date() })
      .where(eq(emprestimos.id, Number(req.params.id)))
      .returning();
    await db.update(livros)
      .set({ disponiveis: sql`${livros.disponiveis} + 1` })
      .where(eq(livros.id, emp[0].livroId!));
    res.json(emp[0]);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar devolução' });
  }
});

router.patch('/:id/retirar', async (req, res) => {
  try {
    // Ao retirar, define automaticamente a data de devolução (8 dias)
    const dataDevolucao = new Date();
    dataDevolucao.setDate(dataDevolucao.getDate() + 8);

    const emp = await db.update(emprestimos)
      .set({ status: 'retirado', dataRetirada: new Date(), dataDevolucao })
      .where(eq(emprestimos.id, Number(req.params.id)))
      .returning();
    res.json({ ...emp[0], status: calcularStatus(emp[0]) });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar retirada' });
  }
});

router.patch('/:id/renovar', async (req, res) => {
  try {
    const resultado = await db.select().from(emprestimos)
      .where(eq(emprestimos.id, Number(req.params.id)));

    if (!resultado.length) {
      return res.status(404).json({ erro: 'Empréstimo não encontrado' });
    }

    const emp = resultado[0];

    if (emp.renovado) {
      return res.status(400).json({ erro: 'Este empréstimo já foi renovado uma vez' });
    }

    // Permite renovar mesmo se estiver atrasado
    if (emp.status !== 'retirado') {
      return res.status(400).json({ erro: 'Só é possível renovar empréstimos com livro retirado' });
    }

    const novaData = new Date();
    novaData.setDate(novaData.getDate() + 5);

    const atualizado = await db.update(emprestimos)
      .set({ renovado: true, dataDevolucao: novaData })
      .where(eq(emprestimos.id, Number(req.params.id)))
      .returning();

    res.json({ ...atualizado[0], status: calcularStatus(atualizado[0]) });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao renovar empréstimo' });
  }
});

router.patch('/retirada-qr', async (req, res) => {
  try {
    const { codigo } = req.body as { codigo?: string };
    if (!codigo) return res.status(400).json({ erro: 'codigo é obrigatório' });

    const result = await pool.query(
      `SELECT e.*, l.titulo as livro_titulo, l.autor as livro_autor, u.nome as usuario_nome, u.turma as usuario_turma
       FROM emprestimos e
       LEFT JOIN livros l ON e.livro_id = l.id
       LEFT JOIN usuarios u ON e.usuario_id = u.id
       WHERE e.retirada_qr_codigo = $1
         AND e.status = 'reservado'`,
      [codigo.trim().toUpperCase()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: 'QR inválido, expirado ou já utilizado' });
    }

    const emp = result.rows[0];

    if (emp.retirada_qr_expira_em && new Date(emp.retirada_qr_expira_em) < new Date()) {
      await pool.query(
        `UPDATE emprestimos SET retirada_qr_codigo = NULL WHERE id = $1`,
        [emp.id]
      );
      return res.status(410).json({ erro: 'QR expirado' });
    }

    // Define data de devolução ao confirmar retirada via QR (8 dias)
    const dataDevolucao = new Date();
    dataDevolucao.setDate(dataDevolucao.getDate() + 8);

    await pool.query(
      `UPDATE emprestimos
       SET status = 'retirado',
           data_retirada = NOW(),
           data_devolucao = $2,
           retirada_qr_usado_em = NOW(),
           retirada_qr_codigo = NULL
       WHERE id = $1`,
      [emp.id, dataDevolucao]
    );

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
  } catch {
    res.status(500).json({ erro: 'Erro ao processar QR de retirada' });
  }
});

router.post('/:id/qr-retirada', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const emp = await db.select().from(emprestimos).where(eq(emprestimos.id, id));
    if (!emp.length) return res.status(404).json({ erro: 'Empréstimo não encontrado' });
    if (emp[0].status !== 'reservado') return res.status(400).json({ erro: 'Empréstimo não está no status reservado' });

    const codigo = crypto.randomBytes(4).toString('hex').toUpperCase();
    const payload = `BIBLIO:${id}:${codigo}`;
    const expira = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `UPDATE emprestimos
       SET retirada_qr_codigo = $1,
           retirada_qr_payload = $2,
           retirada_qr_gerado_em = NOW(),
           retirada_qr_expira_em = $3,
           retirada_qr_usado_em = NULL
       WHERE id = $4`,
      [codigo, payload, expira, id]
    );

    res.json({ codigo, payload, expiraEm: expira.toISOString() });
  } catch {
    res.status(500).json({ erro: 'Erro ao gerar QR de retirada' });
  }
});

export default router;