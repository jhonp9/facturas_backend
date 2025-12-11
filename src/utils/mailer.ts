import nodemailer from 'nodemailer';
import dotenv from 'dotenv'; // <--- 1. Importar dotenv

// 2. Cargar la configuración aquí mismo para asegurar que las variables existan
// antes de crear el transporter.
dotenv.config(); 

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'yhon99676@gmail.com',
    pass: process.env.EMAIL_PASSWORD // Ahora esto sí tendrá el valor del .env
  }
});

export const enviarCodigoVerificacion = async (email: string, codigo: string): Promise<void> => {
  // No usamos try/catch aquí para que el error suba al controlador si falla
  await transporter.sendMail({
    from: '"Sistema Facturación JP" <yhon99676@gmail.com>',
    to: email,
    subject: 'Verifica tu cuenta de empresa',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-w-600px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="color: #2563EB; text-align: center; margin-bottom: 30px;">Código de Verificación</h2>
        <p style="color: #475569; font-size: 16px; text-align: center;">Hola,</p>
        <p style="color: #475569; font-size: 16px; text-align: center;">Usa el siguiente código para completar tu registro en el sistema:</p>
        
        <div style="background-color: #eff6ff; padding: 20px; margin: 30px 0; border-radius: 8px; text-align: center;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1d4ed8;">${codigo}</span>
        </div>
        
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">Si no solicitaste este código, ignora este mensaje.</p>
      </div>
    `
  });
  console.log(`✅ Correo enviado a ${email}`);
};
export const enviarCodigoRecuperacion = async (email: string, codigo: string): Promise<void> => {
  await transporter.sendMail({
    from: '"Sistema Facturación JP" <yhon99676@gmail.com>',
    to: email,
    subject: 'Recuperación de Contraseña',
    html: `
      <div style="font-family: sans-serif; max-w-600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #DC2626; text-align: center;">Recuperar Acceso</h2>
        <p>Hemos recibido una solicitud para cambiar la contraseña de tu empresa.</p>
        <p>Usa el siguiente código para verificar tu identidad:</p>
        
        <div style="background-color: #fef2f2; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; color: #991b1b; letter-spacing: 4px; margin: 20px 0;">
          ${codigo}
        </div>
        
        <p style="font-size: 12px; color: #666;">Si no solicitaste esto, por favor contacta al soporte inmediatamente.</p>
      </div>
    `
  });
  console.log(`✅ Correo de recuperación enviado a ${email}`);
};