import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { enviarCodigoVerificacion } from '../utils/mailer';
import prisma from '../config/prisma';
import cloudinary from '../config/cloudinary';

// 1. REGISTRO
export const register = async (req: Request, res: Response): Promise<void> => {
  let nuevaEmpresaId: number | null = null;
  
  // Con multer-storage-cloudinary, req.file.path es la URL pública
  // y req.file.filename es el public_id (necesario para borrar)
  const logoUrl = req.file?.path; 
  const logoPublicId = req.file?.filename;

  try {
    const { nombreUsuario, emailContacto, passwordAdmin, passwordVendedor } = req.body;

    if (!req.file || !logoUrl) {
      res.status(400).json({ error: "El logo de la empresa es obligatorio" });
      return;
    }

    if (!nombreUsuario || !emailContacto || !passwordAdmin || !passwordVendedor) {
      // Si faltan datos, borramos la imagen que se acaba de subir a Cloudinary
      if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
      res.status(400).json({ error: "Todos los campos son obligatorios" });
      return;
    }

    // 1. Verificar duplicados
    const existe = await prisma.empresa.findUnique({ where: { nombreUsuario } });
    if (existe) {
      // Borramos imagen de Cloudinary porque el usuario ya existe
      if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
      res.status(400).json({ error: "Este nombre de usuario/empresa ya está registrado" });
      return;
    }

    const emailAdmin = `administrador@${nombreUsuario}.com`.toLowerCase();
    const emailVendedor = `vendedor@${nombreUsuario}.com`.toLowerCase();
    const hashAdmin = await bcrypt.hash(passwordAdmin, 10);
    const hashVendedor = await bcrypt.hash(passwordVendedor, 10);
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Crear empresa y usuarios en DB
    // GUARDAMOS LA URL COMPLETA DE CLOUDINARY EN `logoUrl`
    const nuevaEmpresa = await prisma.empresa.create({
      data: {
        nombreUsuario,
        emailContacto,
        logoUrl: logoUrl, // Ahora esto es una URL https://res.cloudinary...
        codigoVerificacion: codigo,
        verificado: false,
        usuarios: {
          create: [
            { email: emailAdmin, password: hashAdmin, rol: "ADMIN" },
            { email: emailVendedor, password: hashVendedor, rol: "VENDEDOR" }
          ]
        }
      }
    });
    
    nuevaEmpresaId = nuevaEmpresa.id;

    // 3. Intentar enviar correo
    try {
        await enviarCodigoVerificacion(emailContacto, codigo);
    } catch (emailError) {
        console.error("Fallo al enviar correo:", emailError);
        
        // ROLLBACK: Borramos DB y la imagen en Cloudinary
        await prisma.usuario.deleteMany({ where: { empresaId: nuevaEmpresa.id } });
        await prisma.empresa.delete({ where: { id: nuevaEmpresa.id } });
        
        if (logoPublicId) {
            await cloudinary.uploader.destroy(logoPublicId);
        }

        res.status(500).json({ error: "No se pudo enviar el correo. Intenta de nuevo." });
        return;
    }

    res.status(201).json({ 
      message: "Registro iniciado. Verifique su correo.", 
      empresaId: nuevaEmpresa.id 
    });

  } catch (error) {
    console.error(error);
    // Limpieza de emergencia en Cloudinary
    if (req.file && req.file.filename) {
        await cloudinary.uploader.destroy(req.file.filename);
    }
    res.status(500).json({ error: "Error interno del servidor al registrar" });
  }
};

// 2. VERIFICACIÓN
export const verify = async (req: Request, res: Response): Promise<void> => {
  try {
    const { empresaId, codigo } = req.body;

    // ParseInt porque los params o body a veces vienen como strings
    const id = parseInt(empresaId);

    const empresa = await prisma.empresa.findUnique({ where: { id } });

    if (!empresa) {
       res.status(404).json({ error: "Empresa no encontrada" });
       return;
    }
    
    if (empresa.codigoVerificacion !== codigo) {
       res.status(400).json({ error: "El código ingresado es incorrecto" });
       return;
    }

    await prisma.empresa.update({
      where: { id },
      data: { verificado: true, codigoVerificacion: null }
    });

    res.json({ message: "Cuenta verificada correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al verificar código" });
  }
};

// 3. LOGIN
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { empresa: true }
    });

    if (!usuario) {
       res.status(401).json({ error: "Usuario no encontrado" });
       return;
    }

    if (!usuario.empresa.verificado) {
       res.status(401).json({ error: "La cuenta de la empresa aún no ha sido verificada" });
       return;
    }

    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida) {
       res.status(401).json({ error: "Contraseña incorrecta" });
       return;
    }

    // Asegúrate de definir JWT_SECRET en tu .env o usa un fallback seguro
    const secret = process.env.JWT_SECRET || 'secreto_super_seguro';
    
    const token = jwt.sign(
      { userId: usuario.id, rol: usuario.rol, empresaId: usuario.empresaId },
      secret,
      { expiresIn: '8h' }
    );

    res.json({
      message: "Login exitoso",
      token,
      user: {
        email: usuario.email,
        rol: usuario.rol,
        nombreUsuario: usuario.empresa.nombreUsuario,
        logo: usuario.empresa.logoUrl
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error en el servidor" });
  }
};