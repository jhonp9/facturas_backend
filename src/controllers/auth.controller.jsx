// server/src/controllers/auth.controller.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { enviarCodigoVerificacion } = require('../utils/mailer');

const prisma = new PrismaClient();

// 1. REGISTRO
exports.register = async (req, res) => {
  try {
    // Datos vienen de FormData (req.body y req.file)
    const { nombreUsuario, emailContacto, passwordAdmin, passwordVendedor } = req.body;
    const logoFile = req.file; // Archivo de imagen

    // Validaciones básicas
    if (!logoFile) return res.status(400).json({ error: "El logo de la empresa es obligatorio" });
    if (!nombreUsuario || !emailContacto) return res.status(400).json({ error: "Faltan datos obligatorios" });

    // Validar si el nombre de usuario (empresa) ya existe
    const existe = await prisma.empresa.findUnique({ where: { nombreUsuario } });
    if (existe) {
      return res.status(400).json({ error: "Este nombre de usuario/empresa ya está registrado" });
    }

    // Generar Emails automáticos
    const emailAdmin = `administrador@${nombreUsuario}.com`.toLowerCase();
    const emailVendedor = `vendedor@${nombreUsuario}.com`.toLowerCase();

    // Encriptar contraseñas
    const hashAdmin = await bcrypt.hash(passwordAdmin, 10);
    const hashVendedor = await bcrypt.hash(passwordVendedor, 10);

    // Generar código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();

    // --- TRANSACCIÓN: Crear todo junto en la BD ---
    const nuevaEmpresa = await prisma.empresa.create({
      data: {
        nombreUsuario,
        emailContacto,
        logoUrl: logoFile.filename, // Guardamos solo el nombre del archivo
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

    // Enviar correo (async, no bloqueamos la respuesta)
    enviarCodigoVerificacion(emailContacto, codigo);

    res.status(201).json({ 
      message: "Registro iniciado. Verifique su correo.", 
      empresaId: nuevaEmpresa.id 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor al registrar" });
  }
};

// 2. VERIFICACIÓN DE CÓDIGO
exports.verify = async (req, res) => {
  try {
    const { empresaId, codigo } = req.body;

    const empresa = await prisma.empresa.findUnique({ where: { id: parseInt(empresaId) } });

    if (!empresa) return res.status(404).json({ error: "Empresa no encontrada" });
    
    // Verificar si el código coincide
    if (empresa.codigoVerificacion !== codigo) {
      return res.status(400).json({ error: "El código ingresado es incorrecto" });
    }

    // Activar empresa y limpiar código
    await prisma.empresa.update({
      where: { id: parseInt(empresaId) },
      data: { 
        verificado: true, 
        codigoVerificacion: null 
      }
    });

    res.json({ message: "Cuenta verificada correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al verificar código" });
  }
};

// 3. LOGIN
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario incluyendo datos de su empresa
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      include: { empresa: true }
    });

    if (!usuario) return res.status(401).json({ error: "Usuario no encontrado" });

    // Verificar si la empresa está verificada por correo
    if (!usuario.empresa.verificado) {
      return res.status(401).json({ error: "La cuenta de la empresa aún no ha sido verificada" });
    }

    // Comparar contraseña
    const esValida = await bcrypt.compare(password, usuario.password);
    if (!esValida) return res.status(401).json({ error: "Contraseña incorrecta" });

    // Generar Token JWT
    const token = jwt.sign(
      { userId: usuario.id, rol: usuario.rol, empresaId: usuario.empresaId },
      process.env.JWT_SECRET || 'secreto_super_seguro',
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