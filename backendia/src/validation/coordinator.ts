import { diagramKey, hash, parseDiagram } from './diagram.js';
import { checkGraph } from './graph.js';
import { checkRules } from './rules.js';
import { analyzeSemantic, DEFAULT_MODEL, PROMPT_VERSION, selectSemanticContext } from './semantic.js';
import type { Finding, ValidationResult } from './types.js';

export interface ValidationRepository {
  readDiagram(projectId: number): Promise<unknown>;
  readCached(projectId: number, snapshotId: string, version: string): Promise<ValidationResult | null>;
  save(result: ValidationResult, requestedById: number): Promise<void>;
}
interface Entry {
  result: ValidationResult;
  controller: AbortController;
  finished: boolean;
  updatedAt: number;
}
type SemanticAnalyzer = typeof analyzeSemantic;
export const catalogVersion = (): string => `sprint2-v2:names-nfd:composition-warning:${process.env.OPENAI_MODEL || DEFAULT_MODEL}:${PROMPT_VERSION}`;

export class ValidationCoordinator {
  private readonly entries = new Map<number, Entry>();
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly generations = new Map<number, number>();
  private revision = 0;
  private activeSemantic = 0;
  constructor(private readonly repository: ValidationRepository,
    private readonly publish: (result: ValidationResult) => Promise<void> = async () => {},
    private readonly semantic: SemanticAnalyzer = analyzeSemantic) {}

  schedule(projectId: number, userId: number, input?: unknown): void {
    if (input !== undefined) {
      try {
        const existing = this.entries.get(projectId);
        if (existing && !existing.controller.signal.aborted && existing.result.catalogVersion === catalogVersion() && existing.result.diagramKey === diagramKey(parseDiagram(input)) &&
          (!existing.finished || existing.result.status === 'ready' || Date.now() - existing.updatedAt < 60000)) return;
      } catch { /* The read endpoint reports invalid stored diagrams. */ }
    }
    const timer = this.timers.get(projectId);
    if (timer) clearTimeout(timer);
    // Invalidate before waiting: an older response must not become current during the pause.
    this.entries.get(projectId)?.controller.abort();
    this.entries.delete(projectId);
    this.generations.set(projectId, ++this.revision);
    if (this.generations.size > 200) {
      const oldest = this.generations.keys().next().value;
      if (oldest !== undefined) this.generations.delete(oldest);
    }
    if (this.timers.size >= 100 && !timer) {
      const oldest = this.timers.keys().next().value;
      if (oldest !== undefined) { clearTimeout(this.timers.get(oldest)); this.timers.delete(oldest); }
    }
    const delay = Math.max(100, Math.min(5000, Number(process.env.VALIDATION_DEBOUNCE_MS) || 500));
    const pending = setTimeout(() => {
      this.timers.delete(projectId);
      void this.current(projectId, userId).catch(() => { /* HTTP/reconnect exposes recoverable failures. */ });
    }, delay);
    pending.unref();
    this.timers.set(projectId, pending);
  }

  async current(projectId: number, userId: number): Promise<ValidationResult> {
    // Coalesce concurrent readers before DB access, including reconnects.
    const generation = this.generations.get(projectId) ?? 0;
    const diagram = parseDiagram(await this.repository.readDiagram(projectId));
    const key = diagramKey(diagram);
    const snapshotId = hash(key);
    const version = catalogVersion();
    const existing = this.entries.get(projectId);
    if (existing && !existing.controller.signal.aborted && existing.result.snapshotId === snapshotId && existing.result.catalogVersion === version &&
      (!existing.finished || existing.result.status === 'ready' || Date.now() - existing.updatedAt < 60000)) return existing.result;
    const cached = await this.repository.readCached(projectId, snapshotId, version);
    // A save while reading invalidates this request; don't install its stale snapshot.
    if ((this.generations.get(projectId) ?? 0) !== generation) return this.current(projectId, userId);
    const raced = this.entries.get(projectId);
    if (raced && !raced.controller.signal.aborted && raced.result.snapshotId === snapshotId && raced.result.catalogVersion === version &&
      (!raced.finished || raced.result.status === 'ready' || Date.now() - raced.updatedAt < 60000)) return raced.result;
    existing?.controller.abort();
    const context = selectSemanticContext(diagram);
    const deterministic = [...checkRules(diagram), ...checkGraph(diagram)];
    const hasSemantic = context.classes.length > 0;
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
    const result: ValidationResult = cached?.status === 'ready' ? { ...cached, diagramKey: key } : {
      projectId: String(projectId), snapshotId, diagramKey: key, catalogVersion: version, modelVersion: hasSemantic ? model : null,
      status: hasSemantic ? 'loading' : 'ready', message: hasSemantic ? 'Reglas revisadas. Consultando posibles problemas de significado…' : 'Revisión completada con las reglas disponibles.',
      notices: this.notices(deterministic, String(projectId), snapshotId, version),
    };
    const entry: Entry = { result, controller: new AbortController(), finished: cached?.status === 'ready', updatedAt: Date.now() };
    if (this.entries.size >= 100 && !this.entries.has(projectId)) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) { this.entries.get(oldest)?.controller.abort(); this.entries.delete(oldest); this.generations.delete(oldest); }
    }
    this.entries.set(projectId, entry);
    if (cached?.status === 'ready') return result;
    if (hasSemantic) void this.finish(projectId, userId, entry, context, deterministic);
    else await this.finish(projectId, userId, entry, context, deterministic);
    return entry.result;
  }

  private notices(findings: Finding[], projectId: string, snapshotId: string, version: string): ValidationResult['notices'] {
    const unique = new Map<string, ValidationResult['notices'][number]>();
    for (const finding of findings) {
      const fingerprint = hash(JSON.stringify(finding));
      unique.set(fingerprint, { ...finding, id: hash(`${projectId}:${snapshotId}:${version}:${fingerprint}`), projectId, snapshotId,
        ruleVersion: version, status: 'active', createdAt: new Date().toISOString() });
    }
    return [...unique.values()];
  }

  private async finish(projectId: number, userId: number, entry: Entry, context: ReturnType<typeof selectSemanticContext>, deterministic: Finding[]): Promise<void> {
    const current = () => !entry.controller.signal.aborted && this.entries.get(projectId) === entry;
    try {
      if (entry.result.status === 'loading') await this.publish(entry.result);
      if (!current()) return;
      if (context.classes.length > 0) {
        if (this.activeSemantic >= 4) throw new Error('Capacidad de análisis semántico ocupada.');
        this.activeSemantic++;
        let semantic: Finding[];
        try { semantic = await this.semantic(context, entry.controller.signal); }
        finally { this.activeSemantic--; }
        if (!current()) return;
        entry.result = { ...entry.result, notices: this.notices([...deterministic, ...semantic], String(projectId), entry.result.snapshotId, entry.result.catalogVersion),
          status: context.truncated ? 'partial' : 'ready', message: context.truncated ? 'Reglas completas. Se revisó una selección limitada de casos semánticos; quedan candidatos sin revisar.' : 'Revisión completada. Las sugerencias de significado requieren revisión del usuario.' };
      }
    } catch {
      if (!current()) return;
      entry.result = { ...entry.result, status: 'partial', message: 'Se conservan las reglas y conexiones revisadas. No se pudo completar el análisis de OpenAI; comprueba la configuración o inténtalo después.' };
    }
    if (!current()) return;
    try {
      // Also protects against updates from another worker/process.
      const latest = diagramKey(parseDiagram(await this.repository.readDiagram(projectId)));
      if (!current() || latest !== entry.result.diagramKey) return;
      await this.repository.save(entry.result, userId);
      if (!current()) return;
    } catch {
      if (!current()) return;
      entry.result = { ...entry.result, status: 'partial', message: 'Resultados disponibles, pero no se pudo guardar la revisión. Se volverá a intentar más adelante.' };
    }
    entry.finished = true; entry.updatedAt = Date.now();
    if (current()) await this.publish(entry.result).catch(() => {});
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    for (const entry of this.entries.values()) entry.controller.abort();
    this.timers.clear(); this.entries.clear(); this.generations.clear();
  }
}
