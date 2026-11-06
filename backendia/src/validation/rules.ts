import { normalizeName } from './diagram.js';
import type { Diagram, Finding, Reference } from './types.js';

export function multiplicity(value: string): { lower: bigint; upper: bigint | null } | null {
  if (!value) return { lower: 1n, upper: 1n }; // UML omitted multiplicity defaults to one.
  if (value === '*') return { lower: 0n, upper: null };
  const match = /^(\d+)(?:\.\.(\d+|\*))?$/.exec(value);
  if (!match?.[1]) return null;
  const lower = BigInt(match[1]);
  const upper = match[2] === '*' ? null : BigInt(match[2] ?? match[1]);
  return upper !== null && upper < lower ? null : { lower, upper };
}

export function checkRules(diagram: Diagram): Finding[] {
  const findings: Finding[] = [];
  const classesById = new Map(diagram.classes.map(item => [item.displayId, normalizeName(item.name)]));
  const add = (ruleCode: string, title: string, explanation: string, recommendation: string, affected: Reference[], severity: Finding['severity'] = 'error') => {
    findings.push({ ruleCode, severity, origin: 'rules', title, explanation, recommendation, affected });
  };
  const duplicates = (items: { name: string; reference: Reference }[], scope: string) => {
    const groups = new Map<string, Reference[]>();
    for (const item of items) {
      const key = normalizeName(item.name);
      if (!key) continue;
      const group = groups.get(key) ?? [];
      group.push(item.reference);
      groups.set(key, group);
    }
    for (const [name, references] of groups) if (references.length > 1) {
      add('R05', `Nombre repetido: ${name}`, `El nombre «${name}» se repite ${scope}, comparando sin mayúsculas ni acentos.`,
        'Revisa si son elementos distintos y asigna nombres que permitan diferenciarlos.', references);
    }
  };
  duplicates(diagram.classes.map(item => ({ name: item.name, reference: { kind: 'class', displayId: item.displayId } })), 'entre las clases');
  for (const item of diagram.classes) duplicates(item.attributes.map(attribute => ({ name: attribute.name,
    reference: { kind: 'attribute', displayId: item.displayId, name: attribute.name } })), `en la clase ${item.name}`);
  for (const relation of diagram.relations) {
    const affected: Reference[] = [{ kind: 'relation', id: relation.id }];
    if (!['asociacion', 'agregacion', 'composicion', 'herencia'].includes(relation.type)) {
      add('R02', 'Tipo de relación desconocido', `La relación usa el tipo «${relation.type}».`, 'Selecciona asociación, agregación, composición o herencia.', affected);
    }
    if (!classesById.has(relation.fromDisplayId) || !classesById.has(relation.toDisplayId)) {
      add('R03', 'Relación con una clase ausente', `La relación ${relation.fromDisplayId} → ${relation.toDisplayId} menciona una clase que no existe en esta revisión.`, 'Revisa los extremos o elimina la relación incompleta.', affected);
    }
    if (relation.type === 'herencia') continue;
    const from = multiplicity(relation.originCard);
    const to = multiplicity(relation.destCard);
    if (relation.type === 'asociacion' && from && to) {
      const source = classesById.get(relation.fromDisplayId);
      const target = classesById.get(relation.toDisplayId);
      const categoryIsSource = source === 'categoria' && target === 'producto';
      const categoryIsTarget = source === 'producto' && target === 'categoria';
      if (categoryIsSource || categoryIsTarget) {
        const categories = categoryIsSource ? from : to;
        const products = categoryIsSource ? to : from;
        if ((categories.upper === null || categories.upper > 1n) && products.lower === 1n && products.upper === 1n) {
          add('R07', 'Posible inversión de multiplicidades entre Categoría y Producto',
            'El diagrama permite varias categorías por producto y exige exactamente un producto por categoría.',
            'Si cada producto debe pertenecer a una sola categoría y cada categoría debe tener uno o más productos, coloca 1..1 junto a Categoría y 1..* junto a Producto. Si admites categorías vacías, usa 0..* junto a Producto.',
            affected, 'recommendation');
        }
      }
    }
    if (!from || !to) add('R01', 'Cantidad de participantes inválida', `La relación contiene «${relation.originCard || '1'}» y «${relation.destCard || '1'}». Los límites deben ser enteros no negativos y estar en orden.`, 'Usa valores como 1, *, 0..* o 1..5.', affected);
    if (relation.type === 'asociacion' && from && to && (from.upper === null || from.upper > 1n) && (to.upper === null || to.upper > 1n)) {
      add('R04', 'Relación muchos a muchos para revisar', 'Ambos extremos admiten varios participantes. El editor no identifica clases de asociación, por lo que no puede confirmar si existe una clase intermedia.',
        'Considera una clase intermedia si necesitas describir datos de la relación. Una relación muchos a muchos puede ser intencional.', affected, 'recommendation');
    }
  }
  return findings;
}
