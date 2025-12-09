import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'yohn99676@gmail.com',
    pass: process.env.EMAIL_PASSWORD // Asegúrate de que esto exista en .env
  }
});

export const enviarCodigoVerificacion = async (email: string, codigo: string): Promise<void> => {
  try {
    await transporter.sendMail({
      from: '"Sistema Facturación Cloud" <yohn99676@gmail.com>',
      to: email,
      subject: 'Verifica tu cuenta de empresa',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f4f4f4;">
          <div style="max-w-600px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px;">
            <h2 style="color: #2563EB;">Bienvenido a Facturación Cloud</h2>
            <p>Tu código de verificación es:</p>
            <div style="background-color: #e0e7ff; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; color: #1e40af;">
              ${codigo}
            </div>
          </div>
        </div>
      `
    });
    console.log(`Correo enviado a ${email}`);
  } catch (error) {
    console.error("Error enviando correo:", error);
  }
};