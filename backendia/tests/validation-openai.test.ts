import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeSemantic, selectSemanticContext } from '../src/validation/semantic.js';

test('OpenAI transport: strict schema, minimal context, one retry, refusal and abort', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-not-a-real-key';
  const context = selectSemanticContext({ classes: [{ displayId: 1, name: 'Cliente', attributes: [{ name: 'domicilio', type: 'String' }, { name: 'direccion_envio', type: 'String' }] }], relations: [] });
  try {
    context.classes.push({ displayId: 2, name: 'Producto', attributes: [] });
    context.relations.push({ id: 'r1', fromDisplayId: 1, toDisplayId: 2, type: 'asociacion', originCard: '1..*', destCard: '1..1', verb: 'clasifica' });
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(String(options?.body));
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.type, 'json_schema');
      assert.ok(!body.input.includes('test-not-a-real-key'));
      assert.deepEqual(JSON.parse(body.input).relations[0].multiplicidadesPorInstancia, [
        { porCadaClaseId: 1, cuentaClaseId: 2, intervalo: { minimo: '1', maximo: '1' } },
        { porCadaClaseId: 2, cuentaClaseId: 1, intervalo: { minimo: '1', maximo: '*' } },
      ]);
      calls++;
      if (calls === 1) return new Response('', { status: 429 });
      return Response.json({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ suggestions: [] }) }] }] });
    };
    assert.deepEqual(await analyzeSemantic(context, new AbortController().signal), []);
    assert.equal(calls, 2);
    globalThis.fetch = async () => Response.json({ status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'No' }] }] });
    await assert.rejects(analyzeSemantic(context, new AbortController().signal));
    globalThis.fetch = async () => Response.json({ status: 'incomplete', output: [] });
    await assert.rejects(analyzeSemantic(context, new AbortController().signal));
    const controller = new AbortController(); controller.abort();
    await assert.rejects(analyzeSemantic(context, controller.signal));
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(analyzeSemantic(context, new AbortController().signal), /OPENAI_API_KEY/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});
