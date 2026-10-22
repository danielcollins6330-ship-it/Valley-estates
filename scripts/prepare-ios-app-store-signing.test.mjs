import assert from "node:assert/strict";
import { chooseCertificateToRevoke, gameCenterCapabilityEnabled, isCertificateLimit } from "./prepare-ios-app-store-signing.mjs";

const limitBody = {
  errors: [{
    status: "409",
    code: "ENTITY_ERROR",
    title: "There is a problem with the request entity",
    detail: "You already have a current iOS Distribution certificate or a pending certificate request.",
  }],
};

assert.equal(isCertificateLimit(409, limitBody), true);
assert.equal(isCertificateLimit(409, { errors: [{ detail: "You already have the maximum number of certificates" }] }), true);
assert.equal(isCertificateLimit(400, limitBody), false);
assert.equal(isCertificateLimit(409, { errors: [{ detail: "Bundle id is not available" }] }), false);

const listed = [
  { id: "AAAAAAAAAA", attributes: { displayName: "Apple Distribution: Someone Else" } },
  { id: "4G8BZ8MGKN", attributes: { displayName: "Apple Distribution: Valley Estates" } },
  { id: "F87GD5XVS2", attributes: { displayName: "Apple Distribution: Valley Estates" } },
];
assert.equal(chooseCertificateToRevoke(listed), "F87GD5XVS2");
assert.equal(chooseCertificateToRevoke(listed.filter((item) => item.id !== "F87GD5XVS2")), "4G8BZ8MGKN");
assert.equal(chooseCertificateToRevoke([
  { id: "ADJS9GQYHR" },
  { id: "38798V9TFT" },
]), "38798V9TFT");
assert.equal(chooseCertificateToRevoke([{ id: "ADJS9GQYHR" }]), "ADJS9GQYHR");
assert.equal(chooseCertificateToRevoke([
  { id: "U86P563X6Z" },
  { id: "ADJS9GQYHR" },
]), "ADJS9GQYHR");
assert.equal(chooseCertificateToRevoke([{ id: "AAAAAAAAAA" }]), null);
assert.equal(chooseCertificateToRevoke([]), null);

assert.equal(gameCenterCapabilityEnabled([
  { attributes: { capabilityType: "GAME_CENTER" } },
]), true);
assert.equal(gameCenterCapabilityEnabled([
  { attributes: { capabilityType: "PUSH_NOTIFICATIONS" } },
]), false);
assert.equal(gameCenterCapabilityEnabled([]), false);
assert.equal(gameCenterCapabilityEnabled(undefined), false);

console.log("prepare-ios-app-store-signing tests passed");
