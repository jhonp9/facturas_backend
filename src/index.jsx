// server/src/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config(); // Cargar variables de entorno

const authRoutes = require('./routes/auth.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors()); // Permitir peticiones desde React (otro puerto)
app.use(express.json()); // Poder leer JSON en el body

// Servir carpeta de imágenes estática
// Esto permite acceder a: http://localhost:3000/uploads/nombre-imagen.png
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas
app.use('/api/auth', authRoutes);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});