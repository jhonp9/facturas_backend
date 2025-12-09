// server/src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const upload = require('../middlewares/upload');

// Ruta POST: /api/auth/register
// Usamos upload.single('logo') para procesar la imagen que viene del form
router.post('/register', upload.single('logo'), authController.register);

// Ruta POST: /api/auth/verify
router.post('/verify', authController.verify);

// Ruta POST: /api/auth/login
router.post('/login', authController.login);

module.exports = router;