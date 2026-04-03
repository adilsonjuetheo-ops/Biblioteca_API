import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import livrosRouter from './routes/livros';
import emprestimosRouter from './routes/emprestimos';
import usuariosRouter from './routes/usuarios';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'API Biblioteca funcionando!' });
});

app.use('/livros', livrosRouter);
app.use('/emprestimos', emprestimosRouter);
app.use('/usuarios', usuariosRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});