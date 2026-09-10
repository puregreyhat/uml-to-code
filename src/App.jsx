import { useState } from 'react';
import { extensions, generateCode, generateUml, parseCode } from './generators';
import { parseJson, parseUml } from './importers';
import Diagram from './components/Diagram';
import CreationHub from './components/CreationHub';

const access = ['private', 'public', 'protected', 'package'];
const symbols = { private: '−', public: '+', protected: '#', package: '~' };
const newClass = (id, name) => ({ id, name, attributes: [], methods: [] });
const initialModel = {
  classes: [{ id: 'student', name: 'Student', attributes: [{ access: 'private', name: 'studId', type: 'int', array: false }, { access: 'public', name: 'name', type: 'String', array: false }, { access: 'protected', name: 'age', type: 'int', array: false }], methods: [{ access: 'public', name: 'learn', returnType: 'void', params: '' }] }],
  relationships: [],
};

function FieldRow({ item, method, onChange, onRemove }) {
  return <div className={`field-row ${method ? 'method-row' : ''}`}>
    <button className={`access ${item.access}`} onClick={() => onChange({ access: access[(access.indexOf(item.access) + 1) % access.length] })}>{symbols[item.access] || '+'}</button>
    <input className="field" placeholder="name" value={item.name} onChange={e => onChange({ name: e.target.value })} />
    <input className="field" placeholder={method ? 'return type' : 'type'} value={method ? item.returnType : item.type} onChange={e => onChange(method ? { returnType: e.target.value } : { type: e.target.value })} />
    {!method && <button className={`array-toggle ${item.array ? 'selected' : ''}`} onClick={() => onChange({ array: !item.array })} aria-label="Toggle array type">[]</button>}
    {method && <input className="field" placeholder="params" value={item.params} onChange={e => onChange({ params: e.target.value })} />}
    <button className="remove" onClick={onRemove} aria-label="Remove">×</button>
  </div>;
}

function Editor({ item, update }) {
  const changeList = (key, index, patch) => update({ [key]: item[key].map((row, i) => i === index ? { ...row, ...patch } : row) });
  const add = key => update({ [key]: [...item[key], key === 'methods' ? { access: 'public', name: '', returnType: 'void', params: '' } : { access: 'private', name: '', type: '', array: false }] });
  const remove = (key, index) => update({ [key]: item[key].filter((_, i) => i !== index) });
  return <div className="uml-card">
    <div className="class-name"><input value={item.name} placeholder="ClassName" onChange={e => update({ name: e.target.value })} /></div>
    {[['attributes', 'Attributes', false], ['methods', 'Methods', true]].map(([key, title, method]) => <section className="section" key={key}>
      <div className="section-head"><span className="section-title">{title}</span><button className="add" onClick={() => add(key)}>+ Add</button></div>
      <div className="field-list">{item[key].map((row, i) => <FieldRow key={i} item={row} method={method} onChange={patch => changeList(key, i, patch)} onRemove={() => remove(key, i)} />)}</div>
    </section>)}
  </div>;
}

export default function App() {
  const [model, setModel] = useState(initialModel);
  const [activeId, setActiveId] = useState('student');
  const [language, setLanguage] = useState('java');
  const [code, setCode] = useState('');
  const [draftCode, setDraftCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedUml, setCopiedUml] = useState(false);
  const [importError, setImportError] = useState('');
  const [view, setView] = useState('input');
  const [aiLoading, setAiLoading] = useState(false);
  const active = model.classes.find(item => item.id === activeId) || model.classes[0];
  const updateClass = patch => setModel(current => ({ ...current, classes: current.classes.map(item => item.id === active.id ? { ...item, ...patch } : item) }));
  const addClass = () => {
    const id = `class-${Date.now()}`;
    setModel(current => ({ ...current, classes: [...current.classes, newClass(id, `Class${current.classes.length + 1}`)] }));
    setActiveId(id);
  };
  const removeClass = id => {
    if (model.classes.length === 1) return;
    const remaining = model.classes.filter(item => item.id !== id);
    setModel({ classes: remaining, relationships: model.relationships.filter(x => x.parentId !== id && x.childId !== id && x.sourceId !== id && x.targetId !== id) });
    setActiveId(remaining[0].id);
  };
  const addInheritance = () => {
    if (model.classes.length < 2) return;
    const child = model.classes.find(x => x.id !== activeId) || model.classes[0];
    if (child.id === activeId || model.relationships.some(x => x.childId === child.id && x.parentId === activeId)) return;
    setModel(current => ({ ...current, relationships: [...current.relationships, { parentId: activeId, childId: child.id, sourceId: child.id, targetId: activeId, type: 'inheritance' }] }));
  };
  const updateRelation = (index, patch) => setModel(current => ({ ...current, relationships: current.relationships.map((x, i) => i === index ? { ...x, ...patch } : x) }));
  const convert = nextLanguage => { const selected = nextLanguage || language; const generated = generateCode(model, selected); setCode(generated); setDraftCode(generated); setView('code'); };
  const importModel = () => { const parsed = parseCode(draftCode, language); if (!parsed) { setImportError('No class declaration found.'); return; } setModel(parsed); setActiveId(parsed.classes[0].id); setCode(draftCode); setImportError(''); setView('input'); };
  const copy = () => navigator.clipboard?.writeText(draftCode).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  const copyUml = () => { const text = generateUml(model); navigator.clipboard?.writeText(text).then(() => { setCopiedUml(true); setTimeout(() => setCopiedUml(false), 1500); }); };
  const download = () => { const blob = new Blob([draftCode], { type: 'text/plain' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `generated.${extensions[language]}`; link.click(); URL.revokeObjectURL(link.href); };
  const loadModel = (nextModel, reveal = 'diagram') => { setImportError(''); setModel(nextModel); setActiveId(nextModel.classes[0]?.id); const generated = generateCode(nextModel, language); setCode(generated); setDraftCode(generated); setView(reveal); };
  const importAiDescription = async description => {
    if (aiLoading) return;
    if (!description.trim()) { setImportError('Describe the system you want to generate.'); return; }
    setImportError('');
    setAiLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }), signal: AbortSignal.timeout(90000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gemini generation failed.');
      loadModel(parseJson(JSON.stringify(data.model)));
    } catch (error) {
      setImportError(error.name === 'TimeoutError' ? 'Gemini took too long. Please try again.' : error.message || 'Could not reach Gemini. Please try again.');
    } finally { setAiLoading(false); }
  };
  const importUml = text => {
    if (aiLoading) return;
    if (!text.trim()) { setImportError('Paste UML before importing.'); return; }
    setImportError('');
    try {
      const parsed = parseUml(text);
      if (parsed) loadModel(parsed);
      else throw new Error('No UML classes or sequence participants found.');
    } catch (error) { setImportError(error.message || 'Could not import UML.'); }
  };
  const importJson = text => {
    if (aiLoading) return;
    try { loadModel(parseJson(text)); }
    catch (error) { setImportError(`Could not import JSON: ${error.message}`); }
  };
  const importFile = async file => {
    if (aiLoading) return;
    setImportError('');
    try {
      const text = await file.text();
      const extension = file.name.split('.').pop().toLowerCase();
      if (extension === 'json') importJson(text);
      else if (['puml', 'plantuml'].includes(extension)) await importUml(text);
      else {
        const fileLanguage = { java: 'java', cpp: 'cpp', cc: 'cpp', py: 'python', ts: 'typescript', cs: 'csharp' }[extension];
        if (!fileLanguage) throw new Error('Choose a UML, JSON, Java, C++, Python, TypeScript, or C# file.');
        const parsed = parseCode(text, fileLanguage);
        if (!parsed) throw new Error('No class declarations found in this file.');
        loadModel(parsed);
      }
    } catch (error) { setImportError(`Could not import file: ${error.message}`); }
  };
  return <><header className="top"><div className="brand"><b className="logo">{'{}'}</b> UML to Code <span className="muted">converter</span></div><nav className="view-tabs" aria-label="Workspace views"><button className={view === 'input' ? 'active' : ''} onClick={() => setView('input')}>Input</button><button className={view === 'diagram' ? 'active' : ''} onClick={() => setView('diagram')}>Diagram</button><button className={view === 'code' ? 'active' : ''} onClick={() => setView('code')}>Code {code && <i>ready</i>}</button></nav><div><label>Output</label><select value={language} onChange={e => { setLanguage(e.target.value); if (code) convert(e.target.value); }}>{Object.keys(extensions).map(x => <option value={x} key={x}>{x === 'csharp' ? 'C#' : x[0].toUpperCase() + x.slice(1)}</option>)}</select></div></header>
    <main className={`app ${view ? `${view}-workspace` : 'no-view'}`}>{view === 'input' ? <section className="builder"><CreationHub onDescription={importAiDescription} aiLoading={aiLoading} onUml={importUml} onJson={importJson} onFile={importFile} onManual={() => document.querySelector('.uml-card')?.scrollIntoView({ behavior: 'smooth' })} error={importError} /><div className="panel-title"><span>Class Editor</span><button className="add" onClick={addClass}>+ Class</button></div>
      <div className="class-tabs">{model.classes.map(item => <button className={item.id === activeId ? 'selected' : ''} key={item.id} onClick={() => setActiveId(item.id)}>{item.name || 'Unnamed'}</button>)}</div>
      <Editor item={active} update={updateClass} />
      <div className="inheritance"><div className="section-head"><span className="section-title">Inheritance / Relationships</span><button className="add" onClick={addInheritance} disabled={model.classes.length < 2}>+ Add</button></div>{model.relationships.length === 0 && <p className="hint">Add a parent-child relationship between classes.</p>}{model.relationships.map((relation, i) => <div className="relation" key={`${relation.parentId}-${relation.childId}-${i}`}><select value={relation.childId} onChange={e => updateRelation(i, { childId: e.target.value, sourceId: e.target.value })}>{model.classes.map(item => <option key={item.id} value={item.id}>{item.name || 'Unnamed'}</option>)}</select><span>extends</span><select value={relation.parentId} onChange={e => updateRelation(i, { parentId: e.target.value, targetId: e.target.value })}>{model.classes.map(item => <option key={item.id} value={item.id}>{item.name || 'Unnamed'}</option>)}</select><button className="remove" onClick={() => setModel(current => ({ ...current, relationships: current.relationships.filter((_, j) => j !== i) }))}>×</button></div>)}</div>
      <div className="class-actions">{model.classes.length > 1 && <button className="delete-class" onClick={() => removeClass(activeId)}>Remove class</button>}<button className="convert" onClick={() => convert()}>Convert →</button></div>
    </section> : view === 'diagram' ? <section className="builder diagram-only"><Diagram classes={model.classes} relationships={model.relationships} activeId={activeId} onSelect={setActiveId} /></section> : view === 'code' ? <section className="output code-view"><div className="output-head"><span>Code input / output</span><div className="output-actions"><button className="copy" onClick={copyUml}>{copiedUml ? 'Copied UML!' : 'Copy UML'}</button><button className="copy" onClick={importModel}>Import to Input</button><button className="copy" onClick={copy}>{copied ? 'Copied!' : 'Copy'}</button><button className="copy" onClick={download}>Download</button></div></div><textarea className="code-input" value={draftCode} onChange={e => { setDraftCode(e.target.value); setImportError(''); }} placeholder="Paste a class here, then click Import to Input." />{importError && <p className="import-error">{importError}</p>}</section> : <section className="view-empty"><p>Select Input to define classes and relationships.</p><div><button className="convert" onClick={() => setView('input')}>Open Input</button><button className="copy" onClick={() => setView('diagram')}>Open Diagram</button><button className="copy" onClick={() => setView('code')}>Open Code</button></div></section>}</main></>;
}
