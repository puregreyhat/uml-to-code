import { useRef, useState } from 'react';

const modes = [['describe', 'Describe system'], ['uml', 'Paste UML'], ['upload', 'Upload file'], ['json', 'Import JSON']];

export default function CreationHub({ onDescription, onUml, onJson, onFile, onManual, aiLoading, error }) {
  const [mode, setMode] = useState('describe');
  const [text, setText] = useState('');
  const fileInput = useRef(null);
  const submit = () => mode === 'describe' ? onDescription(text) : mode === 'uml' ? onUml(text) : onJson(text);
  return <section className="creation-hub">
    <div className="creation-heading"><div><span className="eyebrow">Create UML</span><h2>Start from any source</h2><p>Turn a description, diagram syntax, source file, or JSON model into the same editable UML.</p></div><button className="manual-link" onClick={onManual}>Edit manually ↓</button></div>
    <div className="creation-modes">{modes.map(([id, label]) => <button key={id} className={mode === id ? 'selected' : ''} onClick={() => setMode(id)}>{label}</button>)}</div>
    {mode === 'upload' ? <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!aiLoading && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}><strong>Drop a file here or choose one</strong><span>.puml, .java, .cpp, .py, .ts, .cs, or .json</span><button className="convert" disabled={aiLoading} onClick={() => fileInput.current?.click()}>Choose file</button><input ref={fileInput} type="file" hidden accept=".puml,.plantuml,.java,.cpp,.cc,.py,.ts,.cs,.json" onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; }} /></div> : <><textarea className="creation-input" value={text} onChange={e => setText(e.target.value)} placeholder={mode === 'describe' ? 'Create a banking system with customers, accounts, and transactions...' : mode === 'uml' ? '@startuml\nclass Customer {\n  - id: int\n  + getDetails()\n}\n@enduml' : '{"classes": [{"name": "Customer"}]}'}/><div className="creation-actions"><button className="convert generate-button" onClick={submit} disabled={aiLoading}>{aiLoading ? 'Generating with Gemini...' : mode === 'describe' ? 'Generate with Gemini' : mode === 'uml' ? 'Import UML' : 'Import JSON'} ↗</button></div></>}
    {mode === 'uml' && <p className="hint">Class diagrams import directly. Other UML diagrams use Gemini to infer an editable class diagram and code.</p>}
    {mode === 'upload' && aiLoading && <p role="status">Generating with Gemini...</p>}
    {error && <p className="creation-error" role="alert">{error}</p>}
  </section>;
}
