// Slaat een handmatige tekstwijziging uit de bewerk-modus op als commit naar GitHub.
//
// Vereiste environment variables (Netlify Site configuration -> Environment variables):
//   EDITOR_PASSWORD — het wachtwoord dat de "Opslaan"-knop op de site vraagt
//   GITHUB_TOKEN    — fine-grained personal access token, alleen scope "andere-vragen",
//                     Contents: Read and write
//
// De browser stuurt nooit de GITHUB_TOKEN zelf; die blijft hier op de server.

const OWNER = "Seanishierjahoor";
const REPO = "andere-vragen";
const BRANCH = "main";

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { path, html, password } = await req.json();

    const EDITOR_PASSWORD = Netlify.env.get("EDITOR_PASSWORD");
    const GITHUB_TOKEN = Netlify.env.get("GITHUB_TOKEN");

    if (!EDITOR_PASSWORD || !GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ ok: false, error: "Bewerk-modus is nog niet geconfigureerd (environment variables ontbreken)." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (password !== EDITOR_PASSWORD) {
      return new Response(
        JSON.stringify({ ok: false, error: "Onjuist wachtwoord." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (typeof path !== "string" || !path.startsWith("deploy-") || !path.endsWith(".html") || path.includes("..")) {
      return new Response(
        JSON.stringify({ ok: false, error: "Ongeldig bestandspad." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (typeof html !== "string" || html.length < 20) {
      return new Response(
        JSON.stringify({ ok: false, error: "Lege of ongeldige inhoud." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "andere-vragen-editor",
      Accept: "application/vnd.github+json",
    };

    const currentRes = await fetch(`${apiUrl}?ref=${BRANCH}`, { headers });
    if (!currentRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: `Bestand niet gevonden op GitHub (${currentRes.status}).` }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }
    const current = await currentRes.json();

    const contentBase64 = Buffer.from(html, "utf-8").toString("base64");

    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Bewerk-modus: update ${path}`,
        content: contentBase64,
        sha: current.sha,
        branch: BRANCH,
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.text();
      console.error("GitHub API error:", err);
      return new Response(
        JSON.stringify({ ok: false, error: "GitHub weigerde de commit. Probeer de pagina te verversen en opnieuw." }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in save-edit function:", error);
    return new Response(
      JSON.stringify({ ok: false, error: "Interne fout." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
