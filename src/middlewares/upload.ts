import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'facturas-app-logos', // Nombre de la carpeta en Cloudinary
      allowed_formats: ['jpg', 'png', 'jpeg', 'webp'], // Formatos permitidos
      public_id: `logo-${Date.now()}-${file.originalname.split('.')[0]}` // Nombre único
    };
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

export default upload;