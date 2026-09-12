// This function is automatically triggered by Netlify when a form submission is created.
// It sends a formatted email notification to the site owner, and — where a
// CONFIRMATIONS entry exists for the form — a confirmation email to the submitter.
//
// Required environment variable:
//   RESEND_API_KEY — Get a free key at https://resend.com (100 emails/day free)
//
// LET OP: onboarding@resend.dev is Resend's sandbox-afzender. Zolang er geen eigen
// domein (bv. anderevragen.nl) geverifieerd is in het Resend-dashboard, levert Resend
// de bevestigingsmail aan de aanvrager mogelijk niet af — sandbox-verzending werkt
// doorgaans alleen naar het eigen accountadres. Verifieer het domein bij Resend
// (DNS-records toevoegen) en wijzig de "from"-adressen hieronder voor dit werkt.

export default async (req) => {
  try {
    const body = await req.json();
    const { name, email, message, newsletter, onderwerp } = body.payload.data || {};
    const formName = body.payload.form_name || "contact";

    const FORM_LABELS = {
      contact: { title: "Nieuw bericht", messageLabel: "Bericht", origin: "contactformulier", subject: "Nieuw bericht van" },
      samenkomst: { title: "Nieuwe aanmelding samenkomst", messageLabel: "Opmerking", origin: "aanmeldformulier voor een samenkomst", subject: "Aanmelding samenkomst van" },
      congres: { title: "Nieuwe aanvraag verkennend gesprek", messageLabel: "Wie en wat", origin: "congreslandingspagina", subject: "Aanvraag verkennend gesprek van" },
    };

    const labels = FORM_LABELS[formName];
    if (!labels) {
      return new Response("Skipped — unknown form submission", { status: 200 });
    }

    // Bevestigingsmail aan de aanvrager zelf — alleen voor formulieren die dat nodig hebben.
    const CONFIRMATIONS = {
      congres: {
        subject: "Uw aanvraag bij Andere Vragen",
        body: [
          "Dank voor uw aanvraag.",
          "Ik behandel iedere aanvraag zorgvuldig. Zo snel mogelijk neem ik contact met u op met een voorstel voor een gesprek.",
          "Met vriendelijke groeten,\nAndere Vragen",
        ],
      },
    };

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
            ${labels.title} via Andere Vragen
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
          ${onderwerp ? `<tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; vertical-align: top;">Onderwerp</td>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0ede8;">${onderwerp}</td>
          </tr>` : ""}
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #f0ede8; color: #5a5a5a; vertical-align: top;">${labels.messageLabel}</td>
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
          Dit bericht is automatisch verstuurd via het ${labels.origin} op anderevragen.nl
        </p>
      </div>
    `;

    const textBody = `${labels.title} via Andere Vragen\n${submittedAt}\n\nNaam: ${name || "—"}\nE-mail: ${email || "—"}${onderwerp ? `\nOnderwerp: ${onderwerp}` : ""}\n${labels.messageLabel}: ${message || "—"}\nNieuwsbrief: ${newsletter === "ja" ? "Ja" : "Nee"}\n\nBeantwoord via: mailto:${email}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Andere Vragen <onboarding@resend.dev>",
        to: ["anderevragen@proton.me"],
        subject: `${labels.subject} ${name || "onbekend"} — Andere Vragen`,
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

    // Bevestiging aan de aanvrager — mislukt dit, dan blijft de melding aan Andere Vragen wel geslaagd.
    const confirmation = CONFIRMATIONS[formName];
    if (confirmation && email) {
      try {
        const confirmHtml = `
          <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
            ${confirmation.body.map((p) => `<p style="font-size: 15px; line-height: 1.6; white-space: pre-line;">${p}</p>`).join("\n")}
          </div>
        `;
        const confirmText = confirmation.body.join("\n\n");

        const confirmResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Andere Vragen <onboarding@resend.dev>",
            to: [email],
            subject: confirmation.subject,
            html: confirmHtml,
            text: confirmText,
          }),
        });

        if (!confirmResponse.ok) {
          console.error("Resend API error (bevestigingsmail):", await confirmResponse.text());
        } else {
          console.log("Bevestigingsmail verstuurd aan aanvrager");
        }
      } catch (confirmError) {
        console.error("Fout bij versturen bevestigingsmail:", confirmError);
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error in submission-created function:", error);
    return new Response("Internal error", { status: 500 });
  }
};
