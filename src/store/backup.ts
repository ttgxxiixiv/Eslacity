import { create } from 'zustand';
import { db } from '../db/db';
import { persist } from '../db/persist';
import { startBackup, type BackupRecord } from '../domain/backupPlan';

/** Копии прогресса (задача 16.7): `meta.backup` — когда сохраняли, когда игрок отложил напоминание. */
interface BackupState {
  rec: BackupRecord;
  hydrate(d: BackupRecord | undefined, now?: number): void;
  /** Копия сохранена: своя или автокопия приложения. */
  saved(now?: number, auto?: boolean): void;
  /** «Напомнить через неделю». */
  snooze(now?: number): void;
}

export const useBackup = create<BackupState>((set, get) => {
  const save = (rec: BackupRecord) => {
    set({ rec });
    persist(() => db.meta.put({ key: 'backup', value: rec }));
  };
  return {
    rec: {},
    hydrate(d, now = Date.now()) {
      const rec = startBackup(d, now);
      if (rec !== d) save(rec);
      else set({ rec });
    },
    saved(now = Date.now(), auto = false) {
      save({ ...get().rec, saved: now, ...(auto ? { auto: now } : {}) });
    },
    snooze(now = Date.now()) {
      save({ ...get().rec, snoozed: now });
    },
  };
});
