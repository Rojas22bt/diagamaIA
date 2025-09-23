export type Project = {
  id: string;
  name: string;
  descripcion: string;
  updatedAt: number;
};

const KEY = 'diagramadoria.projects';

export function getProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) return list as Project[];
  } catch {}
  return [];
}

export function saveProjects(list: Project[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function createProject(name: string, descripcion: string): Project {
  const project: Project = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || 'Proyecto sin título',
    descripcion: descripcion.trim(),
    updatedAt: Date.now(),
  };
  const list = getProjects();
  list.unshift(project);
  saveProjects(list);
  return project;
}

export function updateProject(id: string, patch: Partial<Project>): Project | undefined {
  const list = getProjects();
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return undefined;
  const next = { ...list[idx], ...patch, updatedAt: Date.now() } as Project;
  list[idx] = next;
  saveProjects(list);
  return next;
}

export function deleteProject(id: string) {
  const list = getProjects().filter(p => p.id !== id);
  saveProjects(list);
}