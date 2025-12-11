import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import cloudinary from '../config/cloudinary';
import { enviarCodigoVerificacion, enviarCodigoRecuperacion } from '../utils/mailer';
import { consultarRucSunat } from '../services/sunat.service';

// 0. NUEVO: Endpoint para consultar RUC desde el frontend
export const searchRuc = async (req: Request, res: Response): Promise<void> => {
  const { ruc } = req.body;
  if (!ruc || ruc.length !== 11) {
    res.status(400).json({ error: "El RUC debe tener 11 dígitos" });
    return;
  }

  try {
    const existe = await prisma.empresa.findUnique({ where: { ruc } });
    if (existe) {
      res.status(400).json({ error: "Este RUC ya está registrado." });
      return;
    }

    const datos = await consultarRucSunat(ruc);
    
    if (!datos) {
      res.status(404).json({ error: "No se encontraron datos." });
      return;
    }

    // --- MODIFICACIÓN: Buscamos el nombre en múltiples variantes ---
    const nombreEncontrado = 
        datos.razonSocial || 
        datos.nombre || 
        datos.razon_social || 
        datos.ddp_nombre || // Campo raw de SUNAT
        datos.desc_nombre || 
        "";

    const direccionEncontrada = 
        datos.direccion || 
        datos.direccionCompleta || 
        datos.domicilio_fiscal || 
        datos.domicilioFiscal || 
        "";
    // ---------------------------------------------------------------

    const respuestaFrontend = {
        ruc: datos.ruc || datos.numeroDocumento || ruc,
        razonSocial: nombreEncontrado,
        direccion: direccionEncontrada,
        estado: datos.estado,
        condicion: datos.condicion
    };

    res.json(respuestaFrontend);

  } catch (error) {
    console.error("Error searchRuc:", error);
    res.status(500).json({ error: "Error interno" });
  }
};

// 1. REGISTRO
export const register = async (req: Request, res: Response): Promise<void> => {
  const logoUrl = req.file?.path; 
  const logoPublicId = req.file?.filename;

  try {
    const { 
      ruc,
      nombreUsuario, // <--- NUEVO CAMPO RECIBIDO
      razonSocial, 
      direccion, 
      telefonos, 
      emailContacto, 
      passwordAdmin, 
      passwordVendedor 
    } = req.body;

    if (!req.file || !logoUrl) {
      res.status(400).json({ error: "El logo es obligatorio" });
      return;
    }

    // Validaciones
    if (!ruc || !nombreUsuario || !razonSocial || !emailContacto) {
       if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
       res.status(400).json({ error: "Faltan datos obligatorios (RUC, Usuario, Razón Social)" });
       return;
    }

    // 1. Verificar duplicado de RUC
    const existeRuc = await prisma.empresa.findUnique({ where: { ruc } });
    if (existeRuc) {
      if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
      res.status(400).json({ error: "El RUC ya está registrado." });
      return;
    }

    // 2. Verificar duplicado de NOMBRE DE USUARIO (Nuevo)
    const existeUsuario = await prisma.empresa.findUnique({ where: { nombreUsuario } });
    if (existeUsuario) {
      if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
      res.status(400).json({ error: "El nombre de usuario ya existe. Por favor elige otro." });
      return;
    }

    // 3. Verificar duplicado de Email de Contacto
    const existeEmail = await prisma.empresa.findFirst({ where: { emailContacto } });
    if (existeEmail) {
      if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
      res.status(400).json({ error: "El correo de contacto ya está registrado." });
      return;
    }

    // Parsear teléfonos
    let telefonosArray: string[] = [];
    try {
      telefonosArray = typeof telefonos === 'string' ? JSON.parse(telefonos) : telefonos;
    } catch (e) { telefonosArray = []; }

    // --- GENERACIÓN DE CORREOS CON NOMBRE DE USUARIO ---
    // Usamos toLowerCase() para evitar problemas con mayúsculas
    const usuarioLimpio = nombreUsuario.trim().toLowerCase();
    const emailAdmin = `administrador@${usuarioLimpio}.com`;
    const emailVendedor = `vendedor@${usuarioLimpio}.com`;
    // ----------------------------------------------------

    const hashAdmin = await bcrypt.hash(passwordAdmin, 10);
    const hashVendedor = await bcrypt.hash(passwordVendedor, 10);
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    // Crear Empresa
    const nuevaEmpresa = await prisma.empresa.create({
      data: {
        ruc,
        nombreUsuario: usuarioLimpio, // Guardamos el nombre de usuario
        razonSocial,
        direccion: direccion || '',
        nombreComercial: razonSocial,
        emailContacto,
        logoUrl,
        codigoVerificacion: codigo,
        verificado: false,
        telefonos: {
          create: telefonosArray.map((tel) => ({ numero: tel }))
        },
        usuarios: {
          create: [
            { email: emailAdmin, password: hashAdmin, rol: "ADMIN" },
            { email: emailVendedor, password: hashVendedor, rol: "VENDEDOR" }
          ]
        }
      }
    });

    // Enviar correo
    try {
        await enviarCodigoVerificacion(emailContacto, codigo);
    } catch (emailError) {
        // Rollback
        await prisma.telefono.deleteMany({ where: { empresaId: nuevaEmpresa.id }});
        await prisma.usuario.deleteMany({ where: { empresaId: nuevaEmpresa.id } });
        await prisma.empresa.delete({ where: { id: nuevaEmpresa.id } });
        if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
        
        res.status(500).json({ error: "No se pudo enviar el correo de verificación." });
        return;
    }

    res.status(201).json({ 
      message: "Registro exitoso. Verifique su correo.", 
      empresaId: nuevaEmpresa.id 
    });

  } catch (error) {
    console.error(error);
    if (logoPublicId) await cloudinary.uploader.destroy(logoPublicId);
    res.status(500).json({ error: "Error interno del servidor" });
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

// 3. LOGIN (Actualizado)
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
        ruc: usuario.empresa.ruc,           
        razonSocial: usuario.empresa.razonSocial, 
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