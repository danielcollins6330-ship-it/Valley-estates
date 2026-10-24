(function (root) {
  'use strict';
  const DEFAULT_KEY = 'valleyEstatesV4';
  const TYPES = new Set(['homestead','house','barn','field','lumber','quarry','vineyard','winery','paddock','dam','tank','shed','olive','machine','market','cellardoor','valleyvilla','villa','yard','watchtower']);
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  function getKeys(key) { const primary = key || DEFAULT_KEY; return { primary, backup: primary + '_backup', corrupt: primary + '_corrupt' }; }
  function getStorage(custom) { try { return custom || root.localStorage || null; } catch (error) { return null; } }
  function safeParse(raw) { try { return typeof raw === 'string' ? JSON.parse(raw) : null; } catch (error) { return null; } }
  function validateSave(data) {
    if (!object(data)) return false;
    for (const key of ['ter','amt','var','explored']) {
      const array = data[key];
      if (!(Array.isArray(array) || ArrayBuffer.isView(array)) || array.length !== 4096 || !Array.from(array).every(Number.isFinite)) return false;
    }
    if (!object(data.res) || !['food','wood','stone','coins','grapes','wine'].every(key => finite(data.res[key]))) return false;
    if (!object(data.stats) || !['wood','stone','food','trained','wine','coins'].every(key => finite(data.stats[key]))) return false;
    if (!finite(data.time) || data.time < 0 || !Number.isInteger(data.age) || data.age < 0 || data.age > 3) return false;
    if (!Number.isInteger(data.uid) || data.uid < 1 || !object(data.cam) || !['x','y','zoom'].every(key => finite(data.cam[key])) || data.cam.zoom <= 0) return false;
    if (!object(data.techs) || !object(data.events) || !Array.isArray(data.sel) || !Array.isArray(data.units) || !Array.isArray(data.buildings) || !data.buildings.length) return false;
    if (!data.units.every(unit => object(unit) && Number.isInteger(unit.id) && finite(unit.x) && finite(unit.y) && (unit.task == null || object(unit.task)))) return false;
    if (!data.buildings.every(building => object(building) && TYPES.has(building.type) && Number.isInteger(building.id) && ['x','y','w','h'].every(key => finite(building[key])) && building.w > 0 && building.h > 0 && Array.isArray(building.queue) && (building.research == null || (object(building.research) && typeof building.research.id === 'string' && finite(building.research.t) && finite(building.research.total) && building.research.total > 0)))) return false;
    return true;
  }
  function validRaw(raw) { const data = safeParse(raw); return validateSave(data) ? data : null; }
  function archive(storage, keys, raw) { if (raw === null) return true; try { storage.setItem(keys.corrupt, raw); return true; } catch (error) { return false; } }

  function load(custom, key, rejectPrimary) {
    const storage = getStorage(custom), keys = getKeys(key);
    if (!storage) return { status: 'no_storage', choiceRequired: true };
    let primary, backup;
    try { primary = storage.getItem(keys.primary); backup = storage.getItem(keys.backup); }
    catch (error) { return { status: 'storage_error', choiceRequired: true }; }
    const primaryData = validRaw(primary), backupData = validRaw(backup);
    if (primaryData && !rejectPrimary) return { status: 'ok', data: primaryData, source: 'primary' };
    if (primary === null && backup === null && !rejectPrimary) return { status: 'empty', source: 'none' };
    const damagedRaw = primary !== null ? primary : backup;
    const archived = rejectPrimary ? false : archive(storage, keys, damagedRaw);
    return { status: backupData ? 'backup_available' : 'recovery_required', choiceRequired: true, source: backupData ? 'backup' : 'none', backupData, damagedRaw, archived };
  }

  function save(state, custom, key) {
    const storage = getStorage(custom), keys = getKeys(key);
    if (!storage) return { success: false, reason: 'no_storage' };
    if (!validateSave(state)) return { success: false, reason: 'invalid_shape' };
    let raw;
    try { raw = JSON.stringify(state); } catch (error) { return { success: false, reason: 'serialization_error' }; }
    if (!validRaw(raw)) return { success: false, reason: 'invalid_shape' };
    let previous, backup;
    try { previous = storage.getItem(keys.primary); backup = storage.getItem(keys.backup); }
    catch (error) { return { success: false, reason: 'storage_error' }; }
    // Defence in depth: an accidentally unblocked autosave cannot erase damaged data
    // or replace an estate whose primary key vanished while its backup remains.
    if ((previous !== null && !validRaw(previous)) || (previous === null && backup !== null)) return { success: false, reason: 'recovery_required' };
    if (previous !== null) {
      try { storage.setItem(keys.backup, previous); }
      catch (error) { return { success: false, reason: 'backup_write_failed' }; }
    }
    try { storage.setItem(keys.primary, raw); }
    catch (error) { return { success: false, reason: 'storage_error' }; }
    if (previous === null) {
      try { storage.setItem(keys.backup, raw); }
      catch (error) { return { success: true, warning: 'backup_write_failed' }; }
    }
    return { success: true };
  }

  function restoreBackup(custom, key) {
    const storage = getStorage(custom), keys = getKeys(key);
    if (!storage) return { success: false, reason: 'no_storage' };
    let backup, primary;
    try { backup = storage.getItem(keys.backup); primary = storage.getItem(keys.primary); }
    catch (error) { return { success: false, reason: 'storage_error' }; }
    const data = validRaw(backup);
    if (!data) return { success: false, reason: 'invalid_backup' };
    if (primary !== null && !archive(storage, keys, primary)) return { success: false, reason: 'archive_failed' };
    try { storage.setItem(keys.primary, backup); }
    catch (error) { return { success: false, reason: 'storage_error' }; }
    return { success: true, data };
  }

  function resetSave(custom, key) {
    const storage = getStorage(custom), keys = getKeys(key);
    if (!storage) return { success: false, reason: 'no_storage' };
    try {
      // Remove recovery keys first. If deletion fails, retain the primary rather
      // than leave a missing primary that could resurrect an older estate.
      storage.removeItem(keys.backup); storage.removeItem(keys.corrupt); storage.removeItem(keys.primary);
    } catch (error) { return { success: false, reason: 'storage_error' }; }
    return { success: true };
  }
  function getDamagedSave(custom, key) { const storage = getStorage(custom); try { return storage ? storage.getItem(getKeys(key).corrupt) : null; } catch (error) { return null; } }
  function buildRecoveryModalHTML(result) {
    const blocked = result.status === 'no_storage' || result.status === 'storage_error';
    let html = '<h3>Estate save needs attention</h3><p>' + (blocked ? 'Device storage is unavailable. Saving is paused so an existing estate cannot be overwritten. Enable storage, then retry.' : 'The saved estate could not be opened. Its original data has not been replaced. Saving is paused until you choose what to do.') + '</p>';
    if (result.backupData) html += '<button class="btn" data-b="recovery-restore" style="width:100%;margin-bottom:8px">Restore backup estate</button>';
    html += '<button class="btn" data-b="recovery-retry" style="width:100%;margin-bottom:8px">Retry loading</button>';
    if (result.damagedRaw != null) html += '<button class="btn" data-b="recovery-export" style="width:100%;margin-bottom:8px">Export original save data</button>';
    if (!blocked) html += '<button class="btn red" data-b="recovery-newgame" style="width:100%">Start a new estate...</button>';
    return html;
  }
  const api = { DEFAULT_KEY, getKeys, validateSave, load, save, restoreBackup, resetSave, getDamagedSave, buildRecoveryModalHTML };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.VESaveStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
