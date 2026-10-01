// Onderscheid tussen de echte site (production, branch main) en de testsite
// (branch deploy van `staging`). De testsite krijgt een eigen opslag en commit naar
// zijn eigen branch, zodat testaanmeldingen en testwijzigingen nooit op de echte
// site belanden.

export function isProductie(context) {
  return context?.deploy?.context === "production";
}

export function storeNaam(context) {
  return isProductie(context) ? "samenkomsten" : "samenkomsten-staging";
}

export function gitBranch(context) {
  return isProductie(context) ? "main" : "staging";
}
