import { GoogleGenAI } from "@google/genai";

export type FetchGeminiArgs = {
	dataUrl: string; // data:image/...;base64,XXXX
	prompt: string; // instrucción para el modelo
	model?: string; // p.ej. "gemini-2.5-flash"
};

/**
 * Envía imagen (data URL) + prompt a Gemini y devuelve texto (idealmente JSON)
 * Retorna SIEMPRE un string con el texto devuelto por el modelo.
 */
export async function fetchGeminiVisionJSON({ dataUrl, prompt, model }: FetchGeminiArgs): Promise<string> {
	const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
	if (!apiKey) throw new Error("Falta VITE_GEMINI_API_KEY");

	// Tipado laxo para evitar fricciones con cambios de SDK
	const ai: any = new GoogleGenAI({ apiKey });

	// Extraer base64 y mimeType del dataUrl
	const match = dataUrl.match(/^data:(.*?);base64,(.+)$/);
	if (!match) throw new Error("dataUrl inválido");
	const mimeType = match[1] || "image/jpeg";
	const b64 = match[2];

	const chosenModel = model || (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || "gemini-2.5-flash";
	// Evitar usar un modelo de OpenAI con Gemini por error
	if (/^gpt[-_]/i.test(chosenModel)) {
		throw new Error(
			`Modelo no válido para Gemini: "${chosenModel}". Usa, por ejemplo, "gemini-2.5-flash" o define VITE_GEMINI_MODEL.`
		);
	}

	const sysPrompt =
		"Responde exclusivamente con un objeto JSON válido (sin texto extra). " +
		"Incluye 'descripcion', 'objetos' (nombre, confianza 0..1), 'texto_detectado', 'contexto' y 'confianza'. ";

	const contents = [
		{
			inlineData: {
				mimeType,
				data: b64,
			},
		},
		{ text: `${sysPrompt}\n\n${prompt || "Analiza la imagen y devuelve SOLO JSON."}` },
	];

	const result: any = await ai.models.generateContent({ model: chosenModel, contents });
	// La librería puede exponer .text o .response.text()
	const text = result?.text ?? result?.response?.text?.();
	if (!text) throw new Error("Respuesta vacía de Gemini");
	return typeof text === "function" ? text() : text;
}

export default { fetchGeminiVisionJSON };

