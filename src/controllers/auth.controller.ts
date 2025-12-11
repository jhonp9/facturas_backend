import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import cloudinary from '../config/cloudinary';
import { enviarCodigoVerificacion, enviarCodigoRecuperacion } from '../utils/mailer';

// 1. REGISTRO
export const register = async (req: Request, res: Response): Promise<void> => {
  let nuevaEmpresaId: number | null = null;
  
  const logoUrl = req.file?.path; 
  const logoPublicId = req.file?.filename;

  try {
    const { nombreUsuario, emailContacto, passwordAdmin, passwordVendedor } = req.body;

    if (!req.file || !logoUrl) {
      res.status(400).json({ error: "El logo de la empresa es obligatorio" });
      return;
    }

    if (!nombreUsuario || !emailContacto || !passwordAdmin || !passwordVendedor) {
      if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
      res.status(400).json({ error: "Todos los campos son obligatorios" });
      return;
    }

    // 1. Verificar duplicados (Nombre de Empresa)
    const existeNombre = await prisma.empresa.findUnique({ where: { nombreUsuario } });
    if (existeNombre) {
      if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
      res.status(400).json({ error: "Este nombre de empresa ya está registrado" });
      return;
    }

    // 1.5. Verificar duplicados (Email de Contacto) - ¡NUEVA VALIDACIÓN!
    const existeEmail = await prisma.empresa.findFirst({ where: { emailContacto } });
    if (existeEmail) {
      if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
      res.status(400).json({ error: "Ya existe una empresa registrada con este correo electrónico." });
      return;
    }

    const emailAdmin = `administrador@${nombreUsuario}.com`.toLowerCase();
    const emailVendedor = `vendedor@${nombreUsuario}.com`.toLowerCase();
    const hashAdmin = await bcrypt.hash(passwordAdmin, 10);
    const hashVendedor = await bcrypt.hash(passwordVendedor, 10);
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Crear empresa y usuarios en DB
    const nuevaEmpresa = await prisma.empresa.create({
      data: {
        nombreUsuario,
        emailContacto,
        logoUrl: logoUrl,
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
        
        // ROLLBACK
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
    if (logoPublicId) {
        await cloudinary.uploader.destroy(logoPublicId);
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
// 4. SOLICITAR RECUPERACIÓN (Paso 1)
export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Buscamos la empresa por su correo de contacto
    const empresa = await prisma.empresa.findFirst({
      where: { emailContacto: email }
    });

    if (!empresa) {
      // Por seguridad, no decimos si el correo existe o no, pero aquí para desarrollo devolvemos error
      res.status(404).json({ error: "No existe una empresa registrada con este correo." });
      return;
    }

    // Generar código
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    // Guardamos el código en la empresa (reutilizamos el campo codigoVerificacion)
    await prisma.empresa.update({
      where: { id: empresa.id },
      data: { codigoVerificacion: codigo }
    });

    await enviarCodigoRecuperacion(email, codigo);

    res.json({ message: "Código enviado", empresaId: empresa.id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al solicitar recuperación" });
  }
};

// 5. VERIFICAR CÓDIGO DE RECUPERACIÓN (Paso 2)
export const verifyResetCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { empresaId, codigo } = req.body;
    const id = parseInt(empresaId);

    const empresa = await prisma.empresa.findUnique({ where: { id } });

    if (!empresa || empresa.codigoVerificacion !== codigo) {
      res.status(400).json({ error: "Código incorrecto o expirado" });
      return;
    }

    res.json({ message: "Código válido" });
  } catch (error) {
    res.status(500).json({ error: "Error de servidor" });
  }
};

// 6. CAMBIAR CONTRASEÑA (Paso 3)
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { empresaId, codigo, targetRol, newPassword } = req.body;
    // targetRol debe ser "ADMIN" o "VENDEDOR"

    const id = parseInt(empresaId);
    const empresa = await prisma.empresa.findUnique({ 
        where: { id },
        include: { usuarios: true } // Traemos los usuarios para buscar el correcto
    });

    // Verificación final de seguridad
    if (!empresa || empresa.codigoVerificacion !== codigo) {
       res.status(400).json({ error: "Operación no autorizada. Código inválido." });
       return;
    }

    // Buscar el usuario específico (Admin o Vendedor) de esa empresa
    const usuarioObjetivo = empresa.usuarios.find(u => u.rol === targetRol);

    if (!usuarioObjetivo) {
        res.status(404).json({ error: "Usuario no encontrado." });
        return;
    }

    // Hashear nueva password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Actualizar password
    await prisma.usuario.update({
        where: { id: usuarioObjetivo.id },
        data: { password: hashedPassword }
    });

    // Limpiar el código de verificación para que no se pueda reusar
    await prisma.empresa.update({
        where: { id },
        data: { codigoVerificacion: null }
    });

    res.json({ message: `Contraseña de ${targetRol} actualizada correctamente.` });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al actualizar contraseña" });
  }
};