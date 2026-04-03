import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
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