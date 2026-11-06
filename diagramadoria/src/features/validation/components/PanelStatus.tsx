import type { PanelScenario } from '../types';

const MESSAGES: Record<PanelScenario, string> = {
  ready: 'Revisión completada. Consulta los avisos encontrados.',
  loading: 'Esperando el guardado o revisando el diagrama…',
  empty: 'No se encontraron avisos en los aspectos revisados. Esto no garantiza que todo el diagrama sea correcto.',
  partial: 'Revisión parcial. Se muestran los resultados disponibles; algunas comprobaciones no se completaron.',
  failed: 'No se pudo completar la revisión. No se puede concluir que no existan problemas.',
  forbidden: 'No tienes permiso para consultar los resultados de este proyecto.',
};

export function PanelStatus({ scenario }: { scenario: PanelScenario }) {
  return <p className={`validation-status validation-status-${scenario}`} role="status" aria-live="polite">{MESSAGES[scenario]}</p>;
}
