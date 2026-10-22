import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { makeAppStoreToken } from "./register-ios-bundle-id.mjs";

const BUNDLE_ID = "com.littleridgeestate.valleyestates";
const CERT_API = "https://api.appstoreconnect.apple.com/v1/certificates";
const BUNDLE_API = "https://api.appstoreconnect.apple.com/v1/bundleIds";
const CAPABILITY_API = "https://api.appstoreconnect.apple.com/v1/bundleIdCapabilities";
const PROFILE_API = "https://api.appstoreconnect.apple.com/v1/profiles";
export const GAME_CENTER_CAPABILITY = "GAME_CENTER";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", ...options });
  if (result.error) {
    throw new Error(`${command} could not be started.`);
  }
  if (result.status !== 0) {
    const detail = `${result.stderr || ""} ${result.stdout || ""}`.replace(/\s+/g, " ").trim();
    throw new Error(`${command} failed (${result.status}). ${detail.slice(0, 240)}`);
  }
  return result.stdout || "";
}

function publicError(body) {
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  if (!errors.length) return "The response had no error details.";
  return errors
    .map((error) => [error.status, error.code, error.title, error.detail].filter(Boolean).join(" "))
    .join("; ");
}

// Private keys for these CI certificates were deleted with the runner.
// F87GD5XVS2 never signed an upload. 4G8BZ8MGKN signed an IPA that Apple
// rejected before an app record existed, so it is not in use either.
export const UNUSED_CI_DISTRIBUTION_CERTIFICATES = ["F87GD5XVS2", "4G8BZ8MGKN"];

export function isCertificateLimit(status, body) {
  if (status !== 409) return false;
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const text = errors.map((error) => `${error.title || ""} ${error.detail || ""}`).join(" ");
  return /maximum number of certificates|already have the maximum|already have a current iOS Distribution certificate|pending certificate request/i.test(text);
}

export function gameCenterCapabilityEnabled(capabilities) {
  return (capabilities || []).some((item) => item?.attributes?.capabilityType === GAME_CENTER_CAPABILITY);
}

export function chooseCertificateToRevoke(certificates) {
  const known = UNUSED_CI_DISTRIBUTION_CERTIFICATES
    .map((id) => (certificates || []).find((certificate) => certificate && certificate.id === id))
    .find(Boolean);
  return known ? known.id : null;
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

const APPLE_INTERMEDIATES = [
  "https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer",
  "https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer",
  "https://www.apple.com/certificateauthority/AppleWWDRCAG5.cer",
  "https://www.apple.com/certificateauthority/AppleWWDRCAG6.cer",
];

async function importAppleIntermediates(keychainPath) {
  for (const url of APPLE_INTERMEDIATES) {
    const response = await fetch(url);
    if (!response.ok) continue;
    const bytes = Buffer.from(await response.arrayBuffer());
    const cerPath = path.join(path.dirname(keychainPath), path.basename(url));
    writeFileSync(cerPath, bytes);
    const imported = spawnSync("security", ["import", cerPath, "-k", keychainPath, "-A"], { encoding: "utf8" });
    if (imported.status === 0) {
      console.log(`Imported ${path.basename(url)}.`);
    }
  }
}

async function listBundleCapabilities(token, bundleResourceId) {
  // This relationship rejects filter and limit. Follow links.next instead.
  const collected = [];
  let url = `${BUNDLE_API}/${bundleResourceId}/bundleIdCapabilities`;
  let status = 0;
  let body = {};
  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    status = response.status;
    body = await readJson(response);
    if (!response.ok) return { status, ok: false, body };
    if (Array.isArray(body.data)) collected.push(...body.data);
    url = typeof body.links?.next === "string" ? body.links.next : "";
  }
  return { status, ok: true, body: { data: collected } };
}

async function enableGameCenterCapability(token, bundleResourceId) {
  const response = await fetch(CAPABILITY_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        type: "bundleIdCapabilities",
        attributes: { capabilityType: GAME_CENTER_CAPABILITY },
        relationships: {
          bundleId: { data: { type: "bundleIds", id: bundleResourceId } },
        },
      },
    }),
  });
  return { status: response.status, body: await readJson(response) };
}

// The App Store profile only contains entitlements enabled on the App ID.
// The signed app asks for com.apple.developer.game-center, so this must run
// before the profile is created or codesign rejects the archive.
async function ensureGameCenterCapability(token, bundleResourceId) {
  const listed = await listBundleCapabilities(token, bundleResourceId);
  if (!listed.ok) {
    console.error(`Could not read App ID capabilities (HTTP ${listed.status}).`);
    console.error(publicError(listed.body));
    process.exit(1);
  }
  if (gameCenterCapabilityEnabled(listed.body.data)) {
    console.log("Game Center is already enabled on the App ID. The App Store profile will include com.apple.developer.game-center.");
    return;
  }

  const created = await enableGameCenterCapability(token, bundleResourceId);
  if (created.status === 201 || created.status === 200) {
    console.log("Enabled Game Center on the App ID so the App Store profile includes com.apple.developer.game-center.");
    return;
  }

  const confirmed = await listBundleCapabilities(token, bundleResourceId);
  if (confirmed.ok && gameCenterCapabilityEnabled(confirmed.body.data)) {
    console.log("Game Center is enabled on the App ID. The App Store profile will include com.apple.developer.game-center.");
    return;
  }

  console.error(`Could not enable Game Center on ${BUNDLE_ID} (HTTP ${created.status}).`);
  console.error(publicError(created.body));
  if (!confirmed.ok) {
    console.error(`Could not re-read App ID capabilities (HTTP ${confirmed.status}).`);
    console.error(publicError(confirmed.body));
  }
  console.error("Enable it by hand, then rerun this workflow:");
  console.error("Apple Developer → Certificates, Identifiers & Profiles → Identifiers → com.littleridgeestate.valleyestates → Game Center.");
  console.error("Until that capability is on, the App Store profile omits com.apple.developer.game-center and codesign rejects the entitlement.");
  process.exit(1);
}

function appendEnv(name, value) {
  const envFile = process.env.GITHUB_ENV;
  if (!envFile) return;
  writeFileSync(envFile, `${name}=${value}\n`, { flag: "a" });
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

  const workDir = path.join(process.env.RUNNER_TEMP || tmpdir(), "valley-estates-signing");
  mkdirSync(workDir, { mode: 0o700 });
  chmodSync(workDir, 0o700);
  const keyPath = path.join(workDir, "distribution.key");
  const csrPath = path.join(workDir, "distribution.csr");
  const cerPath = path.join(workDir, "distribution.cer");
  const pemPath = path.join(workDir, "distribution.pem");
  const p12Path = path.join(workDir, "distribution.p12");
  const profilePath = path.join(workDir, "profile.mobileprovision");
  const keychainPath = path.join(workDir, "app-signing.keychain-db");
  const passwordPath = path.join(workDir, "keychain-password");
  const identityPath = path.join(workDir, "signing-identity");
  const p12Password = randomBytes(24).toString("base64url");
  const keychainPassword = randomBytes(24).toString("base64url");
  writeFileSync(passwordPath, keychainPassword, { mode: 0o600 });

  run("openssl", [
    "req", "-new", "-newkey", "rsa:2048", "-nodes",
    "-keyout", keyPath,
    "-out", csrPath,
    "-subj", "/CN=Valley Estates CI/O=Valley Estates",
  ]);
  chmodSync(keyPath, 0o600);

  const bundleUrl = new URL(BUNDLE_API);
  bundleUrl.searchParams.set("filter[identifier]", BUNDLE_ID);
  const bundleResponse = await fetch(bundleUrl, { headers: { Authorization: `Bearer ${token}` } });
  const bundleBody = await readJson(bundleResponse);
  const bundle = (bundleBody.data || []).find((item) => item.attributes?.identifier === BUNDLE_ID);
  if (!bundleResponse.ok || !bundle) {
    console.error(`The bundle ID ${BUNDLE_ID} was not readable (HTTP ${bundleResponse.status}).`);
    console.error(publicError(bundleBody));
    process.exit(1);
  }
  await ensureGameCenterCapability(token, bundle.id);

  const csr = readFileSync(csrPath, "utf8");
  const requestDistributionCertificate = async () => {
    const certResponse = await fetch(CERT_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "certificates",
          attributes: {
            certificateType: "IOS_DISTRIBUTION",
            csrContent: csr,
          },
        },
      }),
    });
    return { status: certResponse.status, body: await readJson(certResponse) };
  };
  let created = await requestDistributionCertificate();
  if (created.status !== 201 && isCertificateLimit(created.status, created.body)) {
    console.error(`App Store Connect rejected the distribution certificate with HTTP ${created.status}.`);
    console.error(publicError(created.body));
    const listUrl = new URL(CERT_API);
    listUrl.searchParams.set("filter[certificateType]", "IOS_DISTRIBUTION");
    listUrl.searchParams.set("limit", "20");
    const listResponse = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
    const listBody = await readJson(listResponse);
    const existing = listResponse.ok && Array.isArray(listBody.data) ? listBody.data : [];
    if (!listResponse.ok) {
      console.error(`Could not list distribution certificates (HTTP ${listResponse.status}).`);
      console.error(publicError(listBody));
    }
    for (const certificate of existing) {
      const name = certificate.attributes?.displayName || certificate.attributes?.name || "unnamed";
      const expires = certificate.attributes?.expirationDate || "unknown expiry";
      console.error(`Listed iOS Distribution certificate ${certificate.id} (${name}, ${expires}).`);
    }
    const revokeId = chooseCertificateToRevoke(existing);
    if (!revokeId) {
      console.error("No known unused CI distribution certificate was listed.");
      console.error("Revoke an unused Apple Distribution certificate at developer.apple.com → Certificates, Identifiers & Profiles, then rerun.");
      console.error("Do not revoke a certificate whose private key you still use for an app you ship.");
      process.exit(1);
    }
    console.error(`Revoking unused CI distribution certificate ${revokeId}. Its private key was not kept.`);
    const revokeResponse = await fetch(`${CERT_API}/${revokeId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (revokeResponse.status !== 204 && revokeResponse.status !== 200) {
      const revokeBody = await readJson(revokeResponse);
      console.error(`Could not revoke certificate ${revokeId} (HTTP ${revokeResponse.status}).`);
      console.error(publicError(revokeBody));
      process.exit(1);
    }
    console.log(`Revoked unused CI distribution certificate ${revokeId}.`);
    created = await requestDistributionCertificate();
  }
  if (created.status !== 201) {
    console.error(`App Store Connect rejected the distribution certificate with HTTP ${created.status}.`);
    console.error(publicError(created.body));
    if (isCertificateLimit(created.status, created.body)) {
      console.error("Apple limits how many Apple Distribution certificates a team can hold.");
      console.error("Revoke an unused Apple Distribution certificate at developer.apple.com → Certificates, Identifiers & Profiles, then rerun.");
      console.error("Do not revoke a certificate whose private key you still use for an app you ship.");
    }
    process.exit(1);
  }
  const certBody = created.body;
  const certificateId = certBody.data?.id;
  const certificateContent = certBody.data?.attributes?.certificateContent;
  if (!certificateId || !certificateContent) {
    console.error("App Store Connect created a certificate without returning its id or contents.");
    process.exit(1);
  }
  writeFileSync(cerPath, Buffer.from(certificateContent, "base64"));
  console.log(`Created Apple Distribution certificate ${certificateId}.`);

  const profileName = `Valley Estates App Store ${process.env.GITHUB_RUN_NUMBER || "local"}`;
  const profileResponse = await fetch(PROFILE_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        type: "profiles",
        attributes: {
          name: profileName,
          profileType: "IOS_APP_STORE",
        },
        relationships: {
          bundleId: { data: { type: "bundleIds", id: bundle.id } },
          certificates: { data: [{ type: "certificates", id: certificateId }] },
        },
      },
    }),
  });
  const profileBody = await readJson(profileResponse);
  if (profileResponse.status !== 201) {
    console.error(`App Store Connect rejected the App Store profile with HTTP ${profileResponse.status}.`);
    console.error(publicError(profileBody));
    process.exit(1);
  }
  const profileContent = profileBody.data?.attributes?.profileContent;
  const profileUuid = profileBody.data?.attributes?.uuid;
  if (!profileContent || !profileUuid) {
    console.error("App Store Connect created a profile without returning its contents.");
    process.exit(1);
  }
  writeFileSync(profilePath, Buffer.from(profileContent, "base64"));
  const profilesDir = path.join(homedir(), "Library", "MobileDevice", "Provisioning Profiles");
  mkdirSync(profilesDir, { recursive: true });
  writeFileSync(path.join(profilesDir, `${profileUuid}.mobileprovision`), Buffer.from(profileContent, "base64"));
  console.log(`Installed App Store profile "${profileName}".`);

  run("openssl", ["x509", "-inform", "DER", "-in", cerPath, "-out", pemPath]);
  const pkcs12Args = [
    "pkcs12", "-export",
    "-inkey", keyPath,
    "-in", pemPath,
    "-out", p12Path,
    "-passout", `pass:${p12Password}`,
  ];
  run("openssl", pkcs12Args);
  chmodSync(p12Path, 0o600);

  run("security", ["create-keychain", "-p", keychainPassword, keychainPath]);
  run("security", ["set-keychain-settings", "-lut", "21600", keychainPath]);
  run("security", ["unlock-keychain", "-p", keychainPassword, keychainPath]);
  const importArgs = ["import", p12Path, "-k", keychainPath, "-P", p12Password, "-A", "-f", "pkcs12", "-T", "/usr/bin/codesign", "-T", "/usr/bin/security"];
  const imported = spawnSync("security", importArgs, { encoding: "utf8" });
  if (imported.status !== 0) {
    run("openssl", ["pkcs12", "-export", "-legacy", ...pkcs12Args.slice(2)]);
    chmodSync(p12Path, 0o600);
    run("security", importArgs);
  }
  await importAppleIntermediates(keychainPath);
  run("security", ["set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", keychainPassword, keychainPath]);
  const existing = run("security", ["list-keychains", "-d", "user"]);
  const keychains = existing.split("\n").map((line) => line.trim().replace(/^"|"$/g, "")).filter(Boolean);
  run("security", ["list-keychains", "-d", "user", "-s", keychainPath, ...keychains]);

  let identities = run("security", ["find-identity", "-v", "-p", "codesigning", keychainPath]);
  let match = identities.match(/"([^"]*(?:Apple|iPhone) Distribution[^"]*)"/);
  if (!match) {
    run("openssl", ["pkcs12", "-export", "-legacy", ...pkcs12Args.slice(2)]);
    chmodSync(p12Path, 0o600);
    run("security", importArgs);
    run("security", ["set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", keychainPassword, keychainPath]);
    identities = run("security", ["find-identity", "-v", "-p", "codesigning", keychainPath]);
    match = identities.match(/"([^"]*(?:Apple|iPhone) Distribution[^"]*)"/);
  }
  if (!match) {
    const summary = identities.split("\n").map((line) => line.trim()).find((line) => /valid identities/i.test(line));
    console.error("The distribution certificate was imported, but codesign cannot see a distribution identity.");
    if (summary) console.error(summary);
    process.exit(1);
  }
  writeFileSync(identityPath, match[1], { mode: 0o600 });
  appendEnv("SIGNING_DIR", workDir);
  appendEnv("KEYCHAIN_PATH", keychainPath);
  appendEnv("KEYCHAIN_PASSWORD_FILE", passwordPath);
  appendEnv("PROFILE_NAME", profileName);
  appendEnv("PROFILE_PATH", profilePath);
  appendEnv("SIGNING_IDENTITY_FILE", identityPath);
  console.log("App Store signing assets are ready. The private key is not printed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "App Store signing setup failed.";
    console.error(message);
    process.exit(1);
  });
}
