// Envoie les emails via l'API HTTP de Brevo (anciennement Sendinblue).
// On utilise une API web plutôt que du SMTP classique car Railway bloque
// les connexions SMTP sortantes sur les plans non-Pro.

async function sendPasswordResetEmail(to, resetUrl) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: { email: process.env.EMAIL_FROM, name: "Mufradat" },
      to: [{ email: to }],
      subject: "Réinitialise ton mot de passe Mufradat",
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Réinitialisation de mot de passe</h2>
          <p>Tu as demandé à réinitialiser ton mot de passe sur Mufradat.</p>
          <p><a href="${resetUrl}" style="display:inline-block; padding:10px 20px; background:#3FA98C; color:white; text-decoration:none; border-radius:6px;">Choisir un nouveau mot de passe</a></p>
          <p>Ce lien expire dans 1 heure. Si tu n'es pas à l'origine de cette demande, ignore simplement cet email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Échec envoi email Brevo (${response.status}): ${errorBody}`);
  }
}

module.exports = { sendPasswordResetEmail };
