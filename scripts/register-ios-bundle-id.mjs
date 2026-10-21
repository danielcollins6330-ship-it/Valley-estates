import { createPrivateKey, createSign } from "node:crypto";
import { pathToFileURL } from "node:url";

const BUNDLE_ID = "com.littleridgeestate.valleyestates";
const APP_NAME = "Valley Estates";
const API = "https://api.appstoreconnect.apple.com/v1/bundleIds";

export function isAlreadyExists(status, body) {
  if (status !== 409) return false;
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  if (errors.length === 0) return true;
  return errors.every((error) => {
    const code = String(error.code || "");
    const text = `${error.title || ""} ${error.detail || ""}`;
    return code.includes("DUPLICATE") || /already exists/i.test(text);
  });
}

export function makeAppStoreToken({ issuerId, keyId, privateKeyPem, now = Math.floor(Date.now() / 1000) }) {
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 1200,
    aud: "appstoreconnect-v1",
  })).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const key = createPrivateKey(privateKeyPem);
  const signer = createSign("SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${signature.toString("base64url")}`;
}

function publicError(body) {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  if (!errors.length) return "The response had no error details.";
  return errors
    .map((error) => [error.status, error.code, error.title, error.detail].filter(Boolean).join(" "))
    .join("; ");
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { errors: [{ title: "Response was not JSON", detail: text.slice(0, 300) }] };
  }
}

async function main() {
  const issuerId = process.env.ASC_ISSUER_ID || "";
  const keyId = process.env.ASC_KEY_ID || "";
  const privateKeyPem = process.env.ASC_API_KEY_P8 || "";
  const missing = [
    !issuerId && "ASC_ISSUER_ID",
    !keyId && "ASC_KEY_ID",
    !privateKeyPem && "ASC_API_KEY_P8",
  ].filter(Boolean);
  if (missing.length) {
    console.error(`Missing GitHub Actions secret(s): ${missing.join(", ")}`);
    process.exit(1);
  }

  let token;
  try {
    token = makeAppStoreToken({ issuerId, keyId, privateKeyPem });
  } catch {
    console.error("ASC_API_KEY_P8 could not be read as a private key. Paste the full .p8 file, including the BEGIN and END lines.");
    process.exit(1);
  }

  const response = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        type: "bundleIds",
        attributes: {
          identifier: BUNDLE_ID,
          name: APP_NAME,
          platform: "IOS",
        },
      },
    }),
  });
  const body = await readJson(response);
  if (response.status === 201) {
    console.log(`Registered bundle ID ${BUNDLE_ID} (${body.data?.id || "created"}).`);
  } else if (isAlreadyExists(response.status, body)) {
    console.log(`Bundle ID ${BUNDLE_ID} already exists. Treating that as success.`);
  } else {
    console.error(`App Store Connect rejected bundle ID registration with HTTP ${response.status}.`);
    console.error(publicError(body));
    if (response.status === 401 || response.status === 403) {
      console.error("Check that ASC_ISSUER_ID and ASC_KEY_ID match this .p8 key, and that the key role is Admin or App Manager.");
    }
    process.exit(1);
  }

  const checkUrl = new URL(API);
  checkUrl.searchParams.set("filter[identifier]", BUNDLE_ID);
  const check = await fetch(checkUrl, { headers: { Authorization: `Bearer ${token}` } });
  const checkBody = await readJson(check);
  const found = (checkBody.data || []).find((item) => item.attributes?.identifier === BUNDLE_ID);
  if (!check.ok || !found) {
    console.error(`The bundle ID was not readable after registration (HTTP ${check.status}).`);
    console.error(publicError(checkBody));
    process.exit(1);
  }
  console.log(`Confirmed ${found.attributes.identifier} on ${found.attributes.platform}, name "${found.attributes.name}", id ${found.id}.`);
  console.log("App Store Connect still needs the app record: My Apps → + → New App, using this bundle ID. TestFlight upload cannot succeed until that record exists. This step does not submit anything for review.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Bundle ID registration failed.";
    console.error(message);
    process.exit(1);
  });
}
