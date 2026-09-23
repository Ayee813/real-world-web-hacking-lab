import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import articleRoutes from './routes/articles';
import siemRoutes from './routes/siem';
import { siemAccessLogger } from './middleware/siemLogger';
import { startSiemCaches } from './lib/siem';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(siemAccessLogger);

app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', articleRoutes);
app.use('/api/siem', siemRoutes);

startSiemCaches();

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
