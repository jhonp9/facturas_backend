import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'yhon99676@gmail.com', // Tu correo
    pass: process.env.EMAIL_PASSWORD // Tu contraseña de aplicación
  }
});

export const enviarCodigoVerificacion = async (email: string, codigo: string): Promise<void> => {
  // Eliminamos el try/catch aquí para que el error suba al controlador
  await transporter.sendMail({
    from: '"Sistema Facturación JP" <yohn99676@gmail.com>',
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