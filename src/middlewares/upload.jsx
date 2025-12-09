// server/src/middlewares/upload.js
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Asegúrate de que esta carpeta exista: server/src/uploads
    cb(null, 'src/uploads/');
  },
  filename: (req, file, cb) => {
    // Ejemplo: empresa-123456789.png
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

module.exports = upload;