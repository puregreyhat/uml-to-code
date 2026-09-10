import { useState } from 'react';
import { attributeLabel, methodLabel, layoutDiagram } from '../diagramLayout.js';
import { generateUml } from '../generators.js';

export default function Diagram({ classes, relationships, activeId, onSelect }) {
  const [zoom, setZoom] = useState(null);
  const [copiedUml, setCopiedUml] = useState(false);
  const { nodes, width, height } = layoutDiagram(classes, relationships);

  const copyUml = () => {
    const umlText = generateUml({ classes, relationships });
    navigator.clipboard?.writeText(umlText).then(() => {
      setCopiedUml(true);
      setTimeout(() => setCopiedUml(false), 1500);
    });
  };

  return (
    <section className="diagram-panel">
      <div className="panel-title">
        <span>Diagram <span className="diagram-count">{classes.length} {classes.length === 1 ? 'class' : 'classes'}</span></span>
        <div className="diagram-controls">
          <button className="copy-uml-btn" onClick={copyUml}>{copiedUml ? 'Copied UML!' : 'Copy UML Code'}</button>
          <button onClick={() => setZoom(null)} aria-pressed={zoom === null}>Fit</button>
          <button onClick={() => setZoom(1)} aria-pressed={zoom === 1}>100%</button>
          <button aria-label="Zoom out" onClick={() => setZoom(value => Math.max(.25, (value || 1) - .25))}>−</button>
          <button aria-label="Zoom in" onClick={() => setZoom(value => Math.min(3, (value || 1) + .25))}>+</button>
        </div>
      </div>
      <div className="diagram-board">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: zoom === null ? '100%' : width * zoom, height: zoom === null ? '100%' : height * zoom }} preserveAspectRatio="xMidYMin meet" role="img" aria-label="UML class diagram">
          <defs>
            <marker id="arrow-inheritance" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M1,1 L12,7 L1,13 Z" fill="#0d1626" stroke="#93c5fd" strokeWidth="1.5" />
            </marker>
            <marker id="arrow-association" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 1,1 L 11,6 L 1,11" fill="none" stroke="#93c5fd" strokeWidth="1.5" />
            </marker>
            <marker id="diamond-composition" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 1,7 L 7,1 L 13,7 L 7,13 Z" fill="#93c5fd" stroke="#93c5fd" strokeWidth="1.5" />
            </marker>
            <marker id="diamond-aggregation" markerWidth="14" markerHeight="14" refX="12" refY="7" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 1,7 L 7,1 L 13,7 L 7,13 Z" fill="#0d1626" stroke="#93c5fd" strokeWidth="1.5" />
            </marker>
          </defs>
          {relationships.map((relation, index) => {
            const sourceId = relation.sourceId || relation.parentId;
            const targetId = relation.targetId || relation.childId;
            const source = nodes.get(sourceId);
            const target = nodes.get(targetId);
            if (!source || !target) return null;

            let markerEnd = 'url(#arrow-association)';
            let strokeDasharray = undefined;
            if (relation.type === 'inheritance') markerEnd = 'url(#arrow-inheritance)';
            else if (relation.type === 'composition') markerEnd = 'url(#diamond-composition)';
            else if (relation.type === 'aggregation') markerEnd = 'url(#diamond-aggregation)';
            else if (relation.type === 'dependency') {
              markerEnd = 'url(#arrow-association)';
              strokeDasharray = '4 4';
            }

            let sx, sy, tx, ty;
            if (source.y + source.height < target.y) {
              sx = source.x + source.width / 2;
              sy = source.y + source.height;
              tx = target.x + target.width / 2;
              ty = target.y;
            } else if (target.y + target.height < source.y) {
              sx = source.x + source.width / 2;
              sy = source.y;
              tx = target.x + target.width / 2;
              ty = target.y + target.height;
            } else if (source.x + source.width < target.x) {
              sx = source.x + source.width;
              sy = source.y + source.height / 2;
              tx = target.x;
              ty = target.y + target.height / 2;
            } else if (target.x + target.width < source.x) {
              sx = source.x;
              sy = source.y + source.height / 2;
              tx = target.x + target.width;
              ty = target.y + target.height / 2;
            } else {
              sx = source.x + source.width / 2;
              sy = source.y + source.height;
              tx = target.x + target.width / 2;
              ty = target.y;
            }

            const midY = (sy + ty) / 2;
            const pathData = (sy !== ty && sx !== tx)
              ? `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`
              : `M ${sx} ${sy} L ${tx} ${ty}`;

            return (
              <path
                key={index}
                className="diagram-line"
                d={pathData}
                fill="none"
                strokeDasharray={strokeDasharray}
                markerEnd={markerEnd}
              />
            );
          })}
          {classes.map(item => {
            const point = nodes.get(item.id);
            if (!point) return null;
            return (
              <g className={`diagram-node ${item.id === activeId ? 'active' : ''}`} key={item.id} transform={`translate(${point.x},${point.y})`} onClick={() => onSelect(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(item.id); } }} tabIndex="0" role="button" aria-label={`Select ${item.name || 'unnamed class'}`}>
                <rect width={point.width} height={point.height} rx="8" />
                <text className="diagram-name" x={point.width / 2} y="27" textAnchor="middle">{item.name || 'Unnamed'}</text>
                <line x1="0" y1="42" x2={point.width} y2="42" />
                {item.attributes.map((attribute, index) => <text className="diagram-row" key={`a${index}`} x="16" y={64 + index * 22}>{attributeLabel(attribute)}</text>)}
                <line x1="0" y1={point.divider} x2={point.width} y2={point.divider} />
                {item.methods.map((method, index) => <text className="diagram-row" key={`m${index}`} x="16" y={point.divider + 22 + index * 22}>{methodLabel(method)}</text>)}
              </g>
            );
          })}
        </svg>
        {!classes.length && <p className="diagram-empty">Add a class to start your diagram.</p>}
      </div>
    </section>
  );
}
