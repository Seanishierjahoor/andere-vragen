// This function is automatically triggered by Netlify when a form submission is created.
// It sends a formatted email notification to the site owner.
//
// Required environment variable:
//   RESEND_API_KEY — Get a free key at https://resend.com (100 emails/day free)

export default async (req) => {
  try {
    const body = await req.json();
    const { name, email, message, newsletter } = body.payload.data || {};
    const formName = body.payload.form_name || "contact";

    // Only process the contact form
    if (formName !== "contact") {
      return new Response("Skipped — not a contact form submission", { status: 200 });
    }

    const RESEND_API_KEY = Netlify.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured. Submission received but email not sent.");
      console.log("Submission data:", JSON.stringify({ name, email, message, newsletter }));
      return new Response("No email API key configured", { status: 200 });
    }

    const submittedAt = new Date().toLocaleString("nl-NL", {
      timeZone: "Europe/Amsterdam",
      dateStyle: "full",
      timeStyle: "short",
    });

    const htmlBody = `
      <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <div style="border-bottom: 1px solid #e5e2dd; padding-bottom: 24px; margin-bottom: 24px;">
          <h2 style="font-style: italic; font-weight: 400; font-size: 24px; margin: 0;">
            Nieuw bericht via Andere Vragen
          </h2>
          <p style="color: #5a5a5a; font-size: 13px; margin-top: 8px;">${submittedAt}</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; width: 100px; vertical-align: top;">Naam</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0ede8;">${name || "—"}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; vertical-align: top;">E-mail</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0ede8;">
              <a href="mailto:${email}" style="color: #1a1a1a;">${email || "—"}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; vertical-align: top;">Bericht</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; white-space: pre-wrap;">${message || "—"}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; color: #5a5a5a; vertical-align: top;">Nieuwsbrief</td>
            <td style="padding: 12px 0;">${newsletter === "ja" ? "Ja, wil zich aanmelden" : "Nee"}</td>
          </tr>
        </table>

        <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e2dd;">
          <a href="mailto:${email}?subject=Re: Uw bericht aan Andere Vragen"
             style="display: inline-block; padding: 12px 32px; background: #1a1a1a; color: #fcfaf7; text-decoration: none; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">
            Beantwoorden
          </a>
        </div>

        <p style="font-size: 11px; color: #999; margin-top: 32px; font-style: italic;">
          Dit bericht is automatisch verstuurd via het contactformulier op anderevragen.nl
        </p>
      </div>
    `;

    const textBody = `Nieuw bericht via Andere Vragen\n${submittedAt}\n\nNaam: ${name || "—"}\nE-mail: ${email || "—"}\nBericht: ${message || "—"}\nNieuwsbrief: ${newsletter === "ja" ? "Ja" : "Nee"}\n\nBeantwoord via: mailto:${email}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Andere Vragen <onboarding@resend.dev>",
        to: ["anderevragen@proton.me"],
        subject: `Nieuw bericht van ${name || "onbekend"} — Andere Vragen`,
        html: htmlBody,
        text: textBody,
        reply_to: email || undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend API error:", error);
      return new Response("Email sending failed", { status: 500 });
    }

    console.log("Email notification sent successfully");
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error in submission-created function:", error);
    return new Response("Internal error", { status: 500 });
  }
};
