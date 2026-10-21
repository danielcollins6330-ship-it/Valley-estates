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
const PROFILE_API = "https://api.appstoreconnect.apple.com/v1/profiles";

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

export function isCertificateLimit(status, body) {
  if (status !== 409) return false;
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  return errors.some((error) => /maximum number of certificates|already have the maximum/i.test(`${error.title || ""} ${error.detail || ""}`));
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

  const csr = readFileSync(csrPath, "utf8");
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
  const certBody = await readJson(certResponse);
  if (certResponse.status !== 201) {
    console.error(`App Store Connect rejected the distribution certificate with HTTP ${certResponse.status}.`);
    console.error(publicError(certBody));
    if (isCertificateLimit(certResponse.status, certBody)) {
      console.error("Apple limits how many Apple Distribution certificates a team can hold.");
      console.error("Revoke an unused Apple Distribution certificate at developer.apple.com → Certificates, Identifiers & Profiles, then rerun.");
      console.error("Do not revoke a certificate whose private key you still use for an app you ship.");
    }
    process.exit(1);
  }
  const certificateId = certBody.data?.id;
  const certificateContent = certBody.data?.attributes?.certificateContent;
  if (!certificateId || !certificateContent) {
    console.error("App Store Connect created a certificate without returning its id or contents.");
    process.exit(1);
  }
  writeFileSync(cerPath, Buffer.from(certificateContent, "base64"));
  console.log(`Created Apple Distribution certificate ${certificateId}.`);

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
  run("security", ["set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", keychainPassword, keychainPath]);
  const existing = run("security", ["list-keychains", "-d", "user"]);
  const keychains = existing.split("\n").map((line) => line.trim().replace(/^"|"$/g, "")).filter(Boolean);
  run("security", ["list-keychains", "-d", "user", "-s", keychainPath, ...keychains]);

  const identities = run("security", ["find-identity", "-v", "-p", "codesigning", keychainPath]);
  const match = identities.match(/"([^"]*Apple Distribution[^"]*)"/);
  if (!match) {
    console.error("The distribution certificate was imported, but codesign cannot see an Apple Distribution identity.");
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
