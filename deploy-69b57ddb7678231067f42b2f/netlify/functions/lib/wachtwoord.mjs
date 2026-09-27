// Vergelijkt het ingevoerde wachtwoord met EDITOR_PASSWORD. Spaties, regeleindes en
// onzichtbare tekens aan begin/eind worden genegeerd: die sluipen er makkelijk in bij
// het plakken in de Netlify-UI of een invoerveld.

function normaliseer(waarde) {
  return String(waarde ?? "")
    .normalize("NFC")
    .replace(/^[\s​-‍﻿]+|[\s​-‍﻿]+$/g, "");
}

export function wachtwoordKlopt(ingevoerd, verwacht) {
  const v = normaliseer(verwacht);
  return v.length > 0 && normaliseer(ingevoerd) === v;
}
