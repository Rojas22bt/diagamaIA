import type { ValidationNotice } from '../types';
import { ORIGIN_LABELS, SEVERITY_LABELS } from '../types';
import { referenceLabel } from '../contracts';

interface NoticeDetailProps {
  notice: ValidationNotice;
  missingReferences: string[];
}

export function NoticeDetail({ notice, missingReferences }: NoticeDetailProps) {
  return (
    <section className="validation-detail" aria-label="Detalle del aviso">
      <h3>{notice.title}</h3>
      <p className="validation-meta">
        {notice.ruleCode} · {SEVERITY_LABELS[notice.severity]} · {ORIGIN_LABELS[notice.origin]}
      </p>
      <h4>Explicación</h4>
      <p>{notice.explanation}</p>
      <h4>Recomendación</h4>
      <p>{notice.recommendation}</p>
      <h4>Elementos afectados</h4>
      <ul>
        {notice.affected.map((reference, index) => <li key={index}>{referenceLabel(reference)}</li>)}
      </ul>
      {missingReferences.length > 0 && (
        <p role="status" className="validation-missing">
          No localizable en el lienzo: {missingReferences.join('; ')}. No se crean elementos.
        </p>
      )}
      <p className="validation-meta">
        Captura: {notice.snapshotId} · {notice.ruleVersion}<br />
        Fecha ficticia: {notice.createdAt}
      </p>
    </section>
  );
}
