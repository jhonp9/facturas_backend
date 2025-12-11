// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import { 
  register, 
  verify, 
  login, 
  requestPasswordReset, 
  verifyResetCode, 
  resetPassword 
} from '../controllers/auth.controller';
import upload from '../middlewares/upload';

const router = Router();

router.post('/register', upload.single('logo'), register);
router.post('/verify', verify);
router.post('/login', login);

// Rutas de recuperación
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

export default router;