import '../src/env.js';
import { analyzeSemantic, DEFAULT_MODEL, selectSemanticContext } from '../src/validation/semantic.js';

// Synthetic content only; never reads a project or prints credentials.
const context = selectSemanticContext({ classes: [{ displayId: 1, name: 'Cliente', attributes: [
  { name: 'domicilio', type: 'String' }, { name: 'direccion_envio', type: 'String' },
] }], relations: [] });
try {
  const findings = await analyzeSemantic(context, AbortSignal.timeout(28000));
  console.log(JSON.stringify({ status: 'PASS', model: process.env.OPENAI_MODEL || DEFAULT_MODEL, suggestions: findings.length, referencesValidated: true }));
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', reason: error instanceof Error ? error.message : 'OpenAI no disponible' }));
  process.exitCode = 1;
}
