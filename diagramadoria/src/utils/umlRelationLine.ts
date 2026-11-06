const stroke = '#0b132b';

/** The stored destination is the superclass or the whole, depending on the type. */
export function umlRelationLine(type: string) {
  const emptyMarker = { type: 'path', d: 'M 0 0', fill: 'none', stroke: 'none' };
  const triangle = { type: 'path', d: 'M 0 0 L 16 -9 L 16 9 Z', fill: '#fff', stroke, strokeWidth: 2 };
  const diamond = { type: 'path', d: 'M 0 0 L 10 -6 L 20 0 L 10 6 Z', fill: type === 'composicion' ? stroke : '#fff', stroke, strokeWidth: 2 };
  return {
    stroke,
    strokeWidth: 2,
    sourceMarker: emptyMarker,
    targetMarker: type === 'herencia' ? triangle :
      type === 'agregacion' || type === 'composicion' ? diamond : emptyMarker,
  };
}
