import { pathToFileURL } from "node:url";
import { makeAppStoreToken } from "./register-ios-bundle-id.mjs";

const DEVICE_NAME = "Valley Estates CI";
const DEVICE_UDID = "A1B2C3D4E5F60718293A4B5C6D7E8F9012345678";
const API = "https://api.appstoreconnect.apple.com/v1/devices";

export function isDuplicateDevice(status, body) {
  if (status !== 409) return false;
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  if (errors.length === 0) return true;
  return errors.every((error) => {
    const code = String(error.code || "");
    const text = `${error.title || ""} ${error.detail || ""}`;
    return code.includes("DUPLICATE")
      || /already exists/i.test(text)
      || /already been registered/i.test(text)
      || /not available/i.test(text);
  });
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

async function lookupDevice(token) {
  const checkUrl = new URL(API);
  checkUrl.searchParams.set("filter[udid]", DEVICE_UDID);
  const check = await fetch(checkUrl, { headers: { Authorization: `Bearer ${token}` } });
  const checkBody = await readJson(check);
  const found = (checkBody.data || []).find((item) => item.attributes?.udid === DEVICE_UDID);
  return { ok: check.ok, status: check.status, body: checkBody, found };
}

function logConfirmed(found) {
  console.log(`Confirmed device "${found.attributes.name}" on ${found.attributes.platform}, id ${found.id}.`);
  console.log("This device only lets Xcode create a development profile on a runner with no hardware. App Store export still re-signs for distribution.");
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
        type: "devices",
        attributes: {
          name: DEVICE_NAME,
          platform: "IOS",
          udid: DEVICE_UDID,
        },
      },
    }),
  });
  const body = await readJson(response);
  if (response.status === 409) {
    const existing = await lookupDevice(token);
    if (existing.found) {
      console.log(`Device ${DEVICE_UDID} is already registered on this team. Treating that as success.`);
      logConfirmed(existing.found);
      return;
    }
    console.error(`App Store Connect rejected device registration with HTTP ${response.status}.`);
    console.error(publicError(body));
    if (isDuplicateDevice(response.status, body)) {
      console.error("Apple reports this UDID is already taken, and this API key cannot see it.");
    }
    process.exit(1);
  }

  if (response.status === 201) {
    console.log(`Registered device ${DEVICE_NAME} (${body.data?.id || "created"}).`);
  } else {
    console.error(`App Store Connect rejected device registration with HTTP ${response.status}.`);
    console.error(publicError(body));
    if (response.status === 403) {
      console.error("The API key must be an Account Holder or Admin key to register a device.");
    }
    process.exit(1);
  }

  const check = await lookupDevice(token);
  if (!check.ok || !check.found) {
    console.error(`The device was not readable after registration (HTTP ${check.status}).`);
    console.error(publicError(check.body));
    process.exit(1);
  }
  logConfirmed(check.found);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Device registration failed.";
    console.error(message);
    process.exit(1);
  });
}
