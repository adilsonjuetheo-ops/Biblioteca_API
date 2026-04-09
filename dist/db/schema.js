"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.desejos = exports.avaliacoes = exports.filaEspera = exports.emprestimosComQr = exports.emprestimos = exports.livros = exports.usuarios = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.usuarios = (0, pg_core_1.pgTable)('usuarios', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    nome: (0, pg_core_1.text)('nome').notNull(),
    email: (0, pg_core_1.text)('email').notNull().unique(),
    senha: (0, pg_core_1.text)('senha').notNull().default(''),
    matricula: (0, pg_core_1.text)('matricula'),
    turma: (0, pg_core_1.text)('turma'),
    perfil: (0, pg_core_1.text)('perfil').notNull().default('aluno'),
    criadoEm: (0, pg_core_1.timestamp)('criado_em').defaultNow(),
});
exports.livros = (0, pg_core_1.pgTable)('livros', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    titulo: (0, pg_core_1.text)('titulo').notNull(),
    autor: (0, pg_core_1.text)('autor').notNull(),
    isbn: (0, pg_core_1.text)('isbn'),
    genero: (0, pg_core_1.text)('genero'),
    sinopse: (0, pg_core_1.text)('sinopse'),
    totalExemplares: (0, pg_core_1.integer)('total_exemplares').default(1),
    disponiveis: (0, pg_core_1.integer)('disponiveis').default(1),
    capa: (0, pg_core_1.text)('capa'),
    ativo: (0, pg_core_1.boolean)('ativo').default(true),
    criadoEm: (0, pg_core_1.timestamp)('criado_em').defaultNow(),
});
exports.emprestimos = (0, pg_core_1.pgTable)('emprestimos', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    usuarioId: (0, pg_core_1.integer)('usuario_id').references(() => exports.usuarios.id),
    livroId: (0, pg_core_1.integer)('livro_id').references(() => exports.livros.id),
    dataReserva: (0, pg_core_1.timestamp)('data_reserva').defaultNow(),
    dataRetirada: (0, pg_core_1.timestamp)('data_retirada'),
    dataDevolucao: (0, pg_core_1.timestamp)('data_devolucao'),
    status: (0, pg_core_1.text)('status').default('reservado'),
    renovado: (0, pg_core_1.boolean)('renovado').default(false),
    criadoEm: (0, pg_core_1.timestamp)('criado_em').defaultNow(),
});
// QR columns added via runtime migration – declared here so Drizzle knows about them
exports.emprestimosComQr = (0, pg_core_1.pgTable)('emprestimos', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    usuarioId: (0, pg_core_1.integer)('usuario_id'),
    livroId: (0, pg_core_1.integer)('livro_id'),
    dataReserva: (0, pg_core_1.timestamp)('data_reserva').defaultNow(),
    dataRetirada: (0, pg_core_1.timestamp)('data_retirada'),
    dataDevolucao: (0, pg_core_1.timestamp)('data_devolucao'),
    status: (0, pg_core_1.text)('status').default('reservado'),
    renovado: (0, pg_core_1.boolean)('renovado').default(false),
    criadoEm: (0, pg_core_1.timestamp)('criado_em').defaultNow(),
    retiradaQrCodigo: (0, pg_core_1.text)('retiradaq_r_codigo'),
    retiradaQrPayload: (0, pg_core_1.text)('retiradaq_r_payload'),
    retiradaQrGeradoEm: (0, pg_core_1.timestamp)('retiradaq_r_gerado_em'),
    retiradaQrExpiraEm: (0, pg_core_1.timestamp)('retiradaq_r_expira_em'),
    retiradaQrUsadoEm: (0, pg_core_1.timestamp)('retiradaq_r_usado_em'),
    retiradaQrInvalidadoEm: (0, pg_core_1.timestamp)('retiradaq_r_invalidado_em'),
});
exports.filaEspera = (0, pg_core_1.pgTable)('fila_espera', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    usuarioId: (0, pg_core_1.integer)('usuario_id').references(() => exports.usuarios.id),
    livroId: (0, pg_core_1.integer)('livro_id').references(() => exports.livros.id),
    dataSolicitacao: (0, pg_core_1.timestamp)('data_solicitacao').defaultNow(),
    status: (0, pg_core_1.text)('status').default('aguardando'),
});
exports.avaliacoes = (0, pg_core_1.pgTable)('avaliacoes', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    usuarioId: (0, pg_core_1.integer)('usuario_id').references(() => exports.usuarios.id),
    livroId: (0, pg_core_1.integer)('livro_id').references(() => exports.livros.id),
    nota: (0, pg_core_1.integer)('nota'),
    texto: (0, pg_core_1.text)('texto'),
    criadoEm: (0, pg_core_1.timestamp)('criado_em').defaultNow(),
});
exports.desejos = (0, pg_core_1.pgTable)('desejos', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    usuarioId: (0, pg_core_1.integer)('usuario_id').references(() => exports.usuarios.id),
    livroId: (0, pg_core_1.integer)('livro_id').references(() => exports.livros.id),
    criadoEm: (0, pg_core_1.timestamp)('criado_em').defaultNow(),
});
