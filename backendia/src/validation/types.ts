export type Reference =
  | { kind: 'class'; displayId: number }
  | { kind: 'attribute'; displayId: number; name: string }
  | { kind: 'relation'; id: string };

export interface DiagramClass {
  displayId: number;
  name: string;
  attributes: { name: string; type: string }[];
}
export interface DiagramRelation {
  id: string;
  fromDisplayId: number;
  toDisplayId: number;
  type: string;
  originCard: string;
  destCard: string;
  verb: string;
}
export interface Diagram {
  classes: DiagramClass[];
  relations: DiagramRelation[];
}
export interface Finding {
  ruleCode: string;
  severity: 'error' | 'warning' | 'recommendation';
  origin: 'rules' | 'graph' | 'semantic';
  title: string;
  explanation: string;
  recommendation: string;
  affected: Reference[];
}
export interface Notice extends Finding {
  id: string;
  projectId: string;
  snapshotId: string;
  ruleVersion: string;
  status: 'active' | 'resolved';
  createdAt: string;
}
export interface ValidationResult {
  projectId: string;
  snapshotId: string;
  diagramKey: string;
  catalogVersion: string;
  modelVersion: string | null;
  status: 'loading' | 'ready' | 'partial' | 'failed';
  message: string;
  notices: Notice[];
}
