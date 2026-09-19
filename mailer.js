const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendPasswordResetEmail(to, resetUrl) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Réinitialise ton mot de passe Mufradat",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Réinitialisation de mot de passe</h2>
        <p>Tu as demandé à réinitialiser ton mot de passe sur Mufradat.</p>
        <p><a href="${resetUrl}" style="display:inline-block; padding:10px 20px; background:#3FA98C; color:white; text-decoration:none; border-radius:6px;">Choisir un nouveau mot de passe</a></p>
        <p>Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
