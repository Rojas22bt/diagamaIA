export const SEVERITIES = ['error', 'warning', 'recommendation'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type NoticeOrigin = 'rules' | 'graph' | 'semantic';
export type PanelScenario = 'ready' | 'loading' | 'empty' | 'partial' | 'failed' | 'forbidden';
export type ElementReference =
  | { kind: 'class'; displayId: number }
  | { kind: 'attribute'; displayId: number; name: string }
  | { kind: 'relation'; id: string };

export interface ValidationNotice {
  id: string;
  projectId: string;
  snapshotId: string;
  ruleCode: string;
  ruleVersion: string;
  severity: Severity;
  origin: NoticeOrigin;
  title: string;
  explanation: string;
  recommendation: string;
  affected: ElementReference[];
  status: 'active' | 'resolved';
  createdAt: string;
}

export interface DiagramContext {
  classes: ReadonlyArray<{ displayId: number; name: string }>;
  relations: ReadonlyArray<{ id: string }>;
}

export const SEVERITY_LABELS: Record<Severity, string> = {
  error: 'Error', warning: 'Advertencia', recommendation: 'Recomendación',
};
export const ORIGIN_LABELS: Record<NoticeOrigin, string> = {
  rules: 'Reglas', graph: 'Grafos', semantic: 'Semántico',
};
