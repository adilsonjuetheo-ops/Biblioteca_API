import { pool } from './db/connection';

async function enviarPush(
  token: string,
  titulo: string,
  corpo: string,
  data?: Record<string, unknown>,
) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([{ to: token, title: titulo, body: corpo, sound: 'default', data }]),
  });
}

export async function verificarPrazosEmprestimos() {
  console.log('[Cron] Verificando prazos de empréstimos...');
  try {
    const { rows } = await pool.query<{
      id: number;
      data_devolucao: Date;
      livro_titulo: string;
      push_token: string;
    }>(`
      SELECT e.id, e.data_devolucao, l.titulo AS livro_titulo, u.push_token
      FROM emprestimos e
      JOIN usuarios u ON e.usuario_id = u.id
      JOIN livros l ON e.livro_id = l.id
      WHERE e.status = 'retirado'
        AND e.data_devolucao IS NOT NULL
        AND u.push_token IS NOT NULL
        AND u.perfil IN ('aluno', 'professor')
    `);

    if (rows.length === 0) {
      console.log('[Cron] Nenhum empréstimo ativo com push token para verificar.');
      return;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let contVenceAmanha = 0;
    let contAtrasados = 0;

    for (const emp of rows) {
      const dataDev = new Date(emp.data_devolucao);
      dataDev.setHours(0, 0, 0, 0);
      const diffDias = Math.round((dataDev.getTime() - hoje.getTime()) / 86400000);
      const titulo = emp.livro_titulo || 'Livro emprestado';

      if (diffDias === 1) {
        await enviarPush(
          emp.push_token,
          'Devolução amanhã',
          `"${titulo}" deve ser devolvido amanhã. Renove ou devolva na biblioteca.`,
          { tipo: 'vence_amanha', emprestimoId: emp.id },
        );
        contVenceAmanha++;
      } else if (diffDias === 0) {
        await enviarPush(
          emp.push_token,
          'Devolução hoje',
          `"${titulo}" deve ser devolvido hoje. Não esqueça de passar na biblioteca!`,
          { tipo: 'vence_hoje', emprestimoId: emp.id },
        );
        contAtrasados++;
      } else if (diffDias < 0) {
        const dias = Math.abs(diffDias);
        if (dias % 2 !== 0) {
          const atraso = dias === 1 ? 'está 1 dia atrasado' : `está ${dias} dias atrasado`;
          await enviarPush(
            emp.push_token,
            'Livro em atraso',
            `"${titulo}" ${atraso}. Devolva na biblioteca o quanto antes.`,
            { tipo: 'atrasado', emprestimoId: emp.id },
          );
          contAtrasados++;
        }
      }
    }

    console.log(
      `[Cron] Prazos verificados — vence amanhã: ${contVenceAmanha}, em atraso: ${contAtrasados}.`,
    );
  } catch (e) {
    console.error('[Cron] Erro ao verificar prazos:', (e as Error).message);
  }
}
