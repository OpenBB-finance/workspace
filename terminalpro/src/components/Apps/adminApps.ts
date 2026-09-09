import dayjs from "dayjs";

export interface App {
  uuid: string;
  name: string;
  url: string;
  user_uuid: string;
  user_email: string;
  created_date: string;
  updated_date: string;
}

export interface GroupedApp {
  key: string;
  name: string;
  url: string;
  userCount: number;
  firstAdded: string;
  lastUpdated: string;
  apps: App[];
}

export function formatDate(value: string | undefined) {
  return value ? dayjs(value).locale("en").format("MMM D, YYYY h:mm A") : "-";
}

/**
 * The /admin/apps endpoint returns one row per database record, which can
 * include soft-deleted entries for the same (user, name, url). Collapse to the
 * most recently updated record per tuple so the UI reflects what each user
 * actually has active.
 */
export function dedupeApps(apps: App[]): App[] {
  const latest = new Map<string, App>();
  for (const a of apps) {
    const key = `${a.user_uuid}|||${a.name}|||${a.url}`;
    const existing = latest.get(key);
    if (!existing || a.updated_date > existing.updated_date) {
      latest.set(key, a);
    }
  }
  return Array.from(latest.values());
}

export function groupApps(apps: App[]): GroupedApp[] {
  const map = new Map<string, GroupedApp>();
  for (const a of apps) {
    const key = `${a.name}|||${a.url}`;
    const existing = map.get(key);
    if (existing) {
      existing.apps.push(a);
      existing.userCount += 1;
      if (a.created_date < existing.firstAdded) existing.firstAdded = a.created_date;
      if (a.updated_date > existing.lastUpdated) existing.lastUpdated = a.updated_date;
    } else {
      map.set(key, {
        key,
        name: a.name,
        url: a.url,
        userCount: 1,
        firstAdded: a.created_date,
        lastUpdated: a.updated_date,
        apps: [a],
      });
    }
  }
  return Array.from(map.values());
}
