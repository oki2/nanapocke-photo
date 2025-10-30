export function ReadJwtClientId(token: string): string | undefined {
  const [, payloadB64] = token.split(".");
  if (!payloadB64) throw new Error("Invalid JWT");

  const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const json = Buffer.from(padded, "base64").toString("utf-8");
  const payload = JSON.parse(json);
  return payload?.client_id;
}
