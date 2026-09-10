import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { parseJson } from './src/importers.js';

const send = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
};
const prompt = description => `Convert the description into a UML class model. Return JSON only with this schema: {"classes":[{"name":"ClassName","attributes":[{"access":"private","name":"field","type":"String","array":false}],"methods":[{"access":"public","name":"method","returnType":"void","params":""}]}],"relationships":[{"parentId":"ParentClass","childId":"ChildClass"}]}. Use public/private/protected access. Include useful fields and methods. Relationships represent inheritance only; use exact class names as IDs, no cycles, at most one parent per child. For Animal, Cat, Dog, Cat and Dog inherit Animal. Description: ${description}`;

export function createGenerateHandler(env = process.env, fetchGemini = fetch) {
  return async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/api/generate') return send(response, 404, { error: 'Not found' });
    let description;
    try {
      let body = '';
      for await (const chunk of request) {
        body += chunk;
        if (body.length > 32000) return send(response, 413, { error: 'Description is too long.' });
      }
      ({ description } = JSON.parse(body));
      if (typeof description !== 'string' || !description.trim()) return send(response, 400, { error: 'A system description is required.' });
    } catch { return send(response, 400, { error: 'Invalid request JSON.' }); }
    if (!env.GEMINI_API_KEY) return send(response, 500, { error: 'Set GEMINI_API_KEY in .env and restart npm run dev.' });
    try {
      const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
      const result = await fetchGemini(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt(description) }] }], generationConfig: { responseMimeType: 'application/json' } }),
        signal: AbortSignal.timeout(80000),
      });
      const data = await result.json();
      if (!result.ok) return send(response, result.status, { error: data.error?.message || 'Gemini request failed.' });
      const text = data.candidates?.[0]?.content?.parts?.filter(part => !part.thought).map(part => part.text || '').join('');
      if (!text) return send(response, 502, { error: 'Gemini returned no model. Try rephrasing your description.' });
      const modelData = parseJson(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
      return send(response, 200, { model: modelData });
    } catch (error) {
      return send(response, 502, { error: error.name === 'TimeoutError' ? 'Gemini took too long. Please try again.' : `Could not generate UML: ${error.message}` });
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.API_PORT || 8787);
  http.createServer(createGenerateHandler()).listen(port, () => console.log(`Gemini proxy listening on http://localhost:${port}`));
}
