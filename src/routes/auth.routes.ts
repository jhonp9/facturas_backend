import { Router } from 'express';
import { register, verify, login } from '../controllers/auth.controller';
import upload from '../middlewares/upload';

const router = Router();

router.post('/register', upload.single('logo'), register);
router.post('/verify', verify);
router.post('/login', login);

export default router;