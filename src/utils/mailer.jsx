// server/src/utils/mailer.js
const nodemailer = require('nodemailer');

// Configuración del transporte
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'yohn99676@gmail.com', // El correo que indicaste
    pass: process.env.EMAIL_PASSWORD // Variable de entorno (App Password)
  }
});

const enviarCodigoVerificacion = async (email, codigo) => {
  try {
    await transporter.sendMail({
      from: '"Sistema Facturación Cloud" <yohn99676@gmail.com>',
      to: email,
      subject: 'Verifica tu cuenta de empresa',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="max-w-600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px;">
            <h2 style="color: #2563EB;">Bienvenido a Facturación Cloud</h2>
            <p>Para activar tu cuenta y la de tus vendedores, ingresa el siguiente código:</p>
            <div style="background-color: #e0e7ff; padding: 15px; text-align: center; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #1e40af;">
              ${codigo}
            </div>
            <p style="font-size: 12px; color: gray; margin-top: 20px;">Si no solicitaste esto, ignora este correo.</p>
          </div>
        </div>
      `
    });
    console.log(`Correo enviado a ${email}`);
  } catch (error) {
    console.error("Error enviando correo:", error);
    // No lanzamos error para no detener el registro, pero lo logueamos
  }
};

module.exports = { enviarCodigoVerificacion };