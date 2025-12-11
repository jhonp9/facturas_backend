// server/src/index.ts
import express, { Express } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import prisma from './config/prisma'; // Importamos la instancia que creamos

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Servir estáticos (Imágenes)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Rutas
app.use('/api/auth', authRoutes);

// Función principal para iniciar el servidor
const startServer = async () => {
  try {
    // 1. Intentar conectar a la Base de Datos de Render
    await prisma.$connect();
    console.log('🔌 Conexión exitosa a la base de datos en Render');

    // 2. Si conecta, iniciar el servidor Express
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });

  } catch (error) {
    // 3. Si falla, mostrar el error y cerrar proceso
    console.error('❌ Error fatal: No se pudo conectar a la base de datos.');
    console.error(error);
    process.exit(1);
  }
};

startServer();