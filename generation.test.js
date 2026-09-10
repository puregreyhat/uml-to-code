import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { createGenerateHandler } from './server.js';
import { parseJson } from './src/importers.js';
import { generateCode, generateUml } from './src/generators.js';

test('description goes to Gemini and produces connected diagram data and code', async () => {
  const model = { classes: [{ name: 'Cat' }, { name: 'Dog' }, { name: 'Animal' }], relationships: [{ parentId: 'Animal', childId: 'Cat' }, { parentId: 'Animal', childId: 'Dog' }] };
  let calls = 0;
  const server = http.createServer(createGenerateHandler({ GEMINI_API_KEY: 'test', GEMINI_MODEL: 'test-model' }, async (url, options) => {
    calls++;
    assert.match(url, /test-model:generateContent$/);
    assert.match(JSON.parse(options.body).contents[0].parts[0].text, /generate animal cat dog code/);
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(model) }] } }] });
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/generate`;
    const response = await fetch(url, { method: 'POST', body: JSON.stringify({ description: 'generate animal cat dog code' }) });
    assert.equal(response.status, 200);
    const parsed = parseJson(JSON.stringify((await response.json()).model));
    assert.equal(parsed.classes.length, 3);
    for (const relationship of parsed.relationships) {
      assert.ok(parsed.classes.some(item => item.id === relationship.parentId));
      assert.ok(parsed.classes.some(item => item.id === relationship.childId));
    }
    const code = generateCode(parsed, 'java');
    assert.match(code, /class Cat extends Animal/);
    assert.match(code, /class Dog extends Animal/);
    assert.ok(code.indexOf('class Animal') < code.indexOf('class Cat'));
    const invalid = await fetch(url, { method: 'POST', body: '{"description":""}' });
    assert.equal(invalid.status, 400);
    assert.equal(calls, 1);
    assert.throws(() => parseJson('{"classes":[]}'));
    assert.throws(() => parseJson(JSON.stringify({ ...model, relationships: [{ parentId: 'Dog', childId: 'Cat' }, { parentId: 'Cat', childId: 'Dog' }] })), /cycle/);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('generateUml exports model to PlantUML syntax', () => {
  const model = {
    classes: [
      { id: 'parent', name: 'Parent', attributes: [{ access: 'private', name: 'id', type: 'int', array: false }], methods: [] },
      { id: 'child', name: 'Child', attributes: [], methods: [{ access: 'public', name: 'play', returnType: 'void', params: '' }] }
    ],
    relationships: [
      { parentId: 'parent', childId: 'child', type: 'inheritance' }
    ]
  };
  const umlText = generateUml(model);
  assert.match(umlText, /@startuml/);
  assert.match(umlText, /class Parent/);
  assert.match(umlText, /- int id/);
  assert.match(umlText, /class Child/);
  assert.match(umlText, /\+ play\(\): void/);
  assert.match(umlText, /Parent <\|-- Child/);
  assert.match(umlText, /@enduml/);
});

test('UML and JSON imports normalize models and reject unusable input', async () => {
  const { parseUml } = await import('./src/importers.js');
  const parsed = parseUml('@startuml\nclass Animal\nclass Cat\nAnimal<|--Cat\n@enduml');
  assert.equal(parsed.classes.length, 2);
  assert.match(generateCode(parsed, 'java'), /class Cat extends Animal/);
  const seqParsed = parseUml('@startuml\nactor Student\nparticipant "Web App" as Frontend\nStudent -> Frontend: Submit registration\n@enduml');
  assert.ok(seqParsed);
  assert.equal(seqParsed.classes.length, 2);
  assert.throws(() => parseJson('{"classes":[{"name":"Student","methods":[{"params":{}}]}]}'), /Invalid methods/);
  assert.throws(() => parseJson('{"classes":[{"name":"Student","attributes":{}}]}'), /must be an array/);
  assert.throws(() => parseJson('{"classes":[]}'), /non-empty/);
  assert.throws(() => parseJson('not json'));
});
