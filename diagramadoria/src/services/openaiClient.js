// Cliente OpenAI para React/Vite: llamadas directas desde el navegador
// Nota: exponer tu API Key en el frontend no es seguro para producción.

/**
 * Llama a OpenAI Chat Completions con visión (texto + imagen base64 como data URL)
 * @param {Object} params
 * @param {string} params.dataUrl - Data URL de la imagen (data:image/...;base64,XXXX)
 * @param {string} params.prompt - Instrucción para el modelo
 * @param {string} params.model - Modelo OpenAI (ej. "gpt-4o-mini")
 * @returns {Promise<string>} - Respuesta del modelo (texto)
 */
export async function fetchOpenAIVisionJSON({ dataUrl, prompt, model }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const apiUrl = import.meta.env.VITE_OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
  if (!apiKey) throw new Error("Falta VITE_OPENAI_API_KEY");

  const systemMsg =
    "Eres un analista de imágenes. Responde exclusivamente con un objeto JSON válido (sin texto extra). " +
    "Incluye campos útiles como 'descripcion', 'objetos', 'texto_detectado', 'contexto' y 'confianza' cuando aplique.";

  const body = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: systemMsg },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim?.() || JSON.stringify(data);
}

/**
 * Llama a OpenAI Chat Completions solo texto
 */
export async function fetchOpenAICompletion({ prompt, model }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  const apiUrl = import.meta.env.VITE_OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";
  if (!apiKey) throw new Error("Falta VITE_OPENAI_API_KEY");

  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
  };

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || JSON.stringify(data);
}
