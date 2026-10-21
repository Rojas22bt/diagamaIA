import type { ValidationNotice } from '../types';
import { ORIGIN_LABELS, SEVERITY_LABELS } from '../types';

interface NoticeListProps {
  notices: readonly ValidationNotice[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function NoticeList({ notices, selectedId, onSelect }: NoticeListProps) {
  return (
    <ul className="validation-list" aria-label="Avisos de ejemplo">
      {notices.map(notice => (
        <li key={notice.id}>
          <button
            type="button"
            className="validation-notice"
            aria-pressed={selectedId === notice.id}
            onClick={() => onSelect(notice.id)}
          >
            <span className={`validation-badge validation-badge-${notice.severity}`}>
              {SEVERITY_LABELS[notice.severity]}
            </span>
            <span className="validation-notice-title">{notice.title}</span>
            <span className="validation-meta">{notice.ruleCode} · {ORIGIN_LABELS[notice.origin]}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
