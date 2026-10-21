import type { PanelScenario } from '../types';

const MESSAGES: Record<PanelScenario, string> = {
  ready: 'Avisos ficticios para explorar la interfaz. No describen la validez de este diagrama.',
  loading: 'Simulación: analizando. No hay un motor en ejecución.',
  empty: 'No se detectaron avisos con las reglas revisadas en este escenario de ejemplo. No certifica la corrección del modelo.',
  partial: 'Simulación de análisis parcial: se muestran ejemplos de reglas y grafos. El análisis semántico no está disponible.',
  failed: 'Simulación de fallo del análisis. No se puede concluir que no existan problemas.',
  forbidden: 'Simulación: sin permisos para consultar los resultados de este proyecto.',
};

export function PanelStatus({ scenario }: { scenario: PanelScenario }) {
  return <p className={`validation-status validation-status-${scenario}`} role="status" aria-live="polite">{MESSAGES[scenario]}</p>;
}
