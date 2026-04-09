import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  senha: text('senha').notNull().default(''),
  matricula: text('matricula'),
  turma: text('turma'),
  perfil: text('perfil').notNull().default('aluno'),
  criadoEm: timestamp('criado_em').defaultNow(),
});

export const livros = pgTable('livros', {
  id: serial('id').primaryKey(),
  titulo: text('titulo').notNull(),
  autor: text('autor').notNull(),
  isbn: text('isbn'),
  genero: text('genero'),
  sinopse: text('sinopse'),
  totalExemplares: integer('total_exemplares').default(1),
  disponiveis: integer('disponiveis').default(1),
  capa: text('capa'),
  ativo: boolean('ativo').default(true),
  criadoEm: timestamp('criado_em').defaultNow(),
});

export const emprestimos = pgTable('emprestimos', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  livroId: integer('livro_id').references(() => livros.id),
  dataReserva: timestamp('data_reserva').defaultNow(),
  dataRetirada: timestamp('data_retirada'),
  dataDevolucao: timestamp('data_devolucao'),
  status: text('status').default('reservado'),
  renovado: boolean('renovado').default(false),
  criadoEm: timestamp('criado_em').defaultNow(),
  
});

// QR columns added via runtime migration – declared here so Drizzle knows about them
export const emprestimosComQr = pgTable('emprestimos', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id'),
  livroId: integer('livro_id'),
  dataReserva: timestamp('data_reserva').defaultNow(),
  dataRetirada: timestamp('data_retirada'),
  dataDevolucao: timestamp('data_devolucao'),
  status: text('status').default('reservado'),
  renovado: boolean('renovado').default(false),
  criadoEm: timestamp('criado_em').defaultNow(),
  retiradaQrCodigo: text('retiradaq_r_codigo'),
  retiradaQrPayload: text('retiradaq_r_payload'),
  retiradaQrGeradoEm: timestamp('retiradaq_r_gerado_em'),
  retiradaQrExpiraEm: timestamp('retiradaq_r_expira_em'),
  retiradaQrUsadoEm: timestamp('retiradaq_r_usado_em'),
  retiradaQrInvalidadoEm: timestamp('retiradaq_r_invalidado_em'),
});

export const filaEspera = pgTable('fila_espera', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  livroId: integer('livro_id').references(() => livros.id),
  dataSolicitacao: timestamp('data_solicitacao').defaultNow(),
  status: text('status').default('aguardando'),
});

export const avaliacoes = pgTable('avaliacoes', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  livroId: integer('livro_id').references(() => livros.id),
  nota: integer('nota'),
  texto: text('texto'),
  criadoEm: timestamp('criado_em').defaultNow(),
});

export const desejos = pgTable('desejos', {
  id: serial('id').primaryKey(),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  livroId: integer('livro_id').references(() => livros.id),
  criadoEm: timestamp('criado_em').defaultNow(),
});
export const comunicados = pgTable('comunicados', {
  id: serial('id').primaryKey(),
  titulo: text('titulo').notNull(),
  mensagem: text('mensagem').notNull(),
  autor: text('autor').notNull(),
  destinatario: text('destinatario').default('todos'),
  criadoEm: timestamp('criado_em').defaultNow(),
});