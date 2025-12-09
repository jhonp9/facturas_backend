// server/src/config/prisma.ts
import { PrismaClient } from '@prisma/client';

// Instancia única de Prisma para toda la app
const prisma = new PrismaClient();

export default prisma;