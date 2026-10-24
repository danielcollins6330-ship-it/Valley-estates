import { writeFileSync } from 'node:fs';
import { makeAppStoreToken } from './register-ios-bundle-id.mjs';
const bundle = 'com.littleridgeestate.valleyestates';
const base = 'https://api.appstoreconnect.apple.com';
const token = makeAppStoreToken({ issuerId: process.env.ASC_ISSUER_ID.trim(), keyId: process.env.ASC_KEY_ID.trim(), privateKeyPem: process.env.ASC_API_KEY_P8 });
const report = { checkedAt: new Date().toISOString(), bundle, readOnly: true, errors: [] };
async function get(path) {
  const response = await fetch(base + path, { method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (!response.ok) { report.errors.push({ path, status: response.status, errors: body.errors?.map(e => ({ code: e.code, title: e.title, detail: e.detail })) }); return null; }
  return body;
}
const apps = await get('/v1/apps?filter[bundleId]=' + encodeURIComponent(bundle));
const app = apps?.data?.find(x => x.attributes?.bundleId === bundle);
if (app) {
  report.app = { id: app.id, name: app.attributes.name, bundleId: app.attributes.bundleId };
  const versions = await get(`/v1/apps/${app.id}/appStoreVersions?limit=10&include=build`);
  report.versions = versions?.data?.map(x => ({ id: x.id, attributes: { versionString: x.attributes.versionString, appStoreState: x.attributes.appStoreState, appVersionState: x.attributes.appVersionState, platform: x.attributes.platform, releaseType: x.attributes.releaseType, createdDate: x.attributes.createdDate }, build: x.relationships?.build?.data }));
  report.selectedBuilds = versions?.included?.filter(x => x.type === 'builds').map(x => ({ id: x.id, attributes: x.attributes }));
  const builds = await get(`/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=8`);
  report.builds = builds?.data?.map(x => ({ id: x.id, attributes: x.attributes }));
  report.betaReviews = [];
  for (const build of (builds?.data || []).slice(0,4)) {
    const review = await get(`/v1/builds/${build.id}/betaAppReviewSubmission`);
    if (review?.data) report.betaReviews.push({ buildId: build.id, review: review.data });
  }
  const submissions = await get(`/v1/reviewSubmissions?filter[app]=${app.id}&limit=10&include=items`);
  report.reviewSubmissions = submissions?.data;
  report.reviewItems = submissions?.included;
}
writeFileSync('apple-launch-status.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!app) process.exitCode = 1;
