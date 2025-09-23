export type Collaborator = {
  id: string;
  name: string;
  email?: string;
  role?: 'owner' | 'editor' | 'viewer';
};

export type Activity = {
  id: string;
  type:
    | 'create_class'
    | 'update_class'
    | 'delete_class'
    | 'create_relation'
    | 'delete_relation'
    | 'user_joined'
    | 'user_left'
    | 'change'
    | 'note';
  message: string;
  by?: string; // collaborator id (legacy)
  byUserId?: number; // numeric user id if known
  byName?: string; // display name if known
  at: number; // timestamp
};

const ACTIVE_KEY = 'diagramadoria.activeProjectId';
const COLLAB_KEY = (pid: string) => `diagramadoria.${pid}.collaborators`;
const ACTIVITY_KEY = (pid: string) => `diagramadoria.${pid}.activities`;

export function setActiveProjectId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}
export function getActiveProjectId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function getCollaborators(projectId: string): Collaborator[] {
  try {
    const raw = localStorage.getItem(COLLAB_KEY(projectId));
    return raw ? (JSON.parse(raw) as Collaborator[]) : [];
  } catch { return []; }
}
export function saveCollaborators(projectId: string, list: Collaborator[]) {
  localStorage.setItem(COLLAB_KEY(projectId), JSON.stringify(list));
}
export function addCollaborator(projectId: string, data: Omit<Collaborator, 'id'>): Collaborator {
  const c: Collaborator = { id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, ...data };
  const list = getCollaborators(projectId);
  list.push(c);
  saveCollaborators(projectId, list);
  return c;
}
export function removeCollaborator(projectId: string, id: string) {
  const list = getCollaborators(projectId).filter(c => c.id !== id);
  saveCollaborators(projectId, list);
}

export function getActivities(projectId: string): Activity[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY(projectId));
    return raw ? (JSON.parse(raw) as Activity[]) : [];
  } catch { return []; }
}
export function saveActivities(projectId: string, list: Activity[]) {
  localStorage.setItem(ACTIVITY_KEY(projectId), JSON.stringify(list));
}
export function addActivity(projectId: string, act: Omit<Activity, 'id' | 'at'>) {
  const a: Activity = { id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`, at: Date.now(), ...act };
  const list = getActivities(projectId);
  list.unshift(a);
  saveActivities(projectId, list);
}