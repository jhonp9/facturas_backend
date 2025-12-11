import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Definir la ruta absoluta a la raiz del proyecto + 'uploads'
// Usamos process.cwd() para asegurar que funcione tanto en local como en compilado
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Crear la carpeta si no existe
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    // Limpiamos el nombre original de espacios y caracteres raros
    const cleanName = file.originalname.replace(/\s+/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + cleanName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Limite de 5MB
});

export default upload;