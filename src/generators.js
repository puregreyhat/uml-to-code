const maps = {
  cpp: { String: 'std::string', string: 'std::string', boolean: 'bool', int: 'int', double: 'double', float: 'float', void: 'void' },
  python: { String: 'str', string: 'str', boolean: 'bool', int: 'int', float: 'float', double: 'float', void: 'None' },
  typescript: { int: 'number', String: 'string', float: 'number', double: 'number', boolean: 'boolean', bool: 'boolean', void: 'void' },
};

const typeOf = (type, language, array = false) => maps[language]?.[type] || type || ({ java: 'Object', csharp: 'object', cpp: 'int', python: 'Any', typescript: 'any' }[language]);

const attributeType = (attribute, language) => {
  const type = typeOf(attribute.type, language);
  if (!attribute.array) return type;
  if (language === 'cpp') return `std::vector<${type}>`;
  if (language === 'python') return `list[${type}]`;
  return `${type}[]`;
};

const valid = item => item.name.trim();

export function formatParams(paramsString, language) {
  if (!paramsString || !paramsString.trim()) return '';
  return paramsString.split(',').map(param => {
    const text = param.trim();
    if (!text) return '';

    // Handle "name: Type"
    const colonMatch = text.match(/^(\w+)\s*:\s*([\w<>.[\]]+)$/);
    if (colonMatch) {
      const name = colonMatch[1];
      const rawType = colonMatch[2];
      const type = typeOf(rawType, language);
      if (language === 'typescript') return `${name}: ${type}`;
      if (language === 'python') return name;
      return `${type} ${name}`;
    }

    // Handle "Type name"
    const spaceMatch = text.match(/^([\w<>.[\]]+)\s+(\w+)$/);
    if (spaceMatch) {
      const rawType = spaceMatch[1];
      const name = spaceMatch[2];
      const type = typeOf(rawType, language);
      if (language === 'typescript') return `${name}: ${type}`;
      if (language === 'python') return name;
      return `${type} ${name}`;
    }

    return text;
  }).join(', ');
}

function accessPrefix(access, language) {
  if (access === 'package') {
    if (language === 'typescript') return 'public ';
    return ''; // package-private in Java/C++
  }
  return access ? `${access} ` : 'public ';
}

function orderedClasses(classes, relationships) {
  const inheritanceRels = relationships.filter(r => r.type === 'inheritance' || !r.type);
  const parentMap = new Map(inheritanceRels.map(({ childId, parentId }) => [childId, parentId]));
  const result = [];
  const seen = new Set();
  const visit = item => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const parentItem = classes.find(x => x.id === parentMap.get(item.id));
    if (parentItem) visit(parentItem);
    result.push(item);
  };
  classes.forEach(visit);
  return result;
}

function methods(item, language) {
  return item.methods.filter(valid).map(method => {
    const params = formatParams(method.params, language);
    const retType = typeOf(method.returnType, language);
    const prefix = accessPrefix(method.access, language);

    if (language === 'python') return `    def ${method.name}(self${params ? `, ${params}` : ''}):\n        pass`;
    if (language === 'typescript') return `    ${prefix.trim()} ${method.name}(${params}): ${retType} { }`;
    return `    ${prefix}${retType} ${method.name}(${params}) { }`;
  }).join('\n\n');
}

function fields(item, language) {
  return item.attributes.filter(valid).map(attribute => {
    const prefix = accessPrefix(attribute.access, language);
    if (language === 'python') {
      const pyPrefix = attribute.access === 'private' ? '__' : attribute.access === 'protected' ? '_' : '';
      return `        self.${pyPrefix}${attribute.name} = ${attribute.name}`;
    }
    if (language === 'typescript') return `    ${prefix.trim()} ${attribute.name}: ${attributeType(attribute, language)};`;
    return `    ${prefix}${attributeType(attribute, language)} ${attribute.name};`;
  }).join('\n');
}

function generatePython(item, parent, allClasses) {
  const attrs = item.attributes.filter(valid);
  const args = attrs.map(attribute => attribute.name).join(', ');
  const init = attrs.length ? `    def __init__(self, ${args}):\n${fields(item, 'python')}` : '';
  const body = [init, methods(item, 'python')].filter(Boolean).join('\n\n') || '    pass';
  return `class ${item.name}${parent ? `(${parent.name})` : ''}:\n${body}`;
}

function generateCpp(item, parent) {
  const groups = ['public', 'protected', 'private'].map(access => {
    const attrs = item.attributes.filter(x => x.access === access && valid(x)).map(x => `    ${attributeType(x, 'cpp')} ${x.name};`);
    const funcs = item.methods.filter(x => x.access === access && valid(x)).map(x => `    ${typeOf(x.returnType, 'cpp')} ${x.name}(${formatParams(x.params, 'cpp')}) { }`);
    return attrs.concat(funcs).length ? `${access}:\n${attrs.concat(funcs).join('\n')}` : '';
  }).filter(Boolean).join('\n');
  const usesVector = item.attributes.some(x => x.array && valid(x));
  return `${usesVector ? '#include <vector>\n\n' : ''}class ${item.name}${parent ? ` : public ${parent.name}` : ''} {\n${groups}\n};`;
}

export function generateUml(model) {
  if (!model || !Array.isArray(model.classes)) return '@startuml\n@enduml';

  const lines = ['@startuml'];
  const visMap = { public: '+', private: '-', protected: '#', package: '~' };

  for (const item of model.classes) {
    if (!item.name) continue;
    lines.push(`class ${item.name} {`);
    for (const attr of item.attributes || []) {
      if (!attr.name) continue;
      const vis = visMap[attr.access] || '-';
      const arrayType = attr.array ? '[]' : '';
      lines.push(`  ${vis} ${attr.type || 'Object'}${arrayType} ${attr.name}`);
    }
    for (const method of item.methods || []) {
      if (!method.name) continue;
      const vis = visMap[method.access] || '+';
      lines.push(`  ${vis} ${method.name}(${method.params || ''}): ${method.returnType || 'void'}`);
    }
    lines.push('}');
    lines.push('');
  }

  for (const rel of model.relationships || []) {
    const parentId = rel.parentId || rel.sourceId;
    const childId = rel.childId || rel.targetId;
    const sourceClass = model.classes.find(c => c.id === (rel.sourceId || parentId));
    const targetClass = model.classes.find(c => c.id === (rel.targetId || childId));

    if (rel.type === 'inheritance') {
      const parentClass = model.classes.find(c => c.id === rel.parentId);
      const childClass = model.classes.find(c => c.id === rel.childId);
      if (parentClass && childClass) {
        lines.push(`${parentClass.name} <|-- ${childClass.name}`);
      }
    } else if (sourceClass && targetClass) {
      if (rel.type === 'composition') {
        lines.push(`${sourceClass.name} *-- ${targetClass.name}`);
      } else if (rel.type === 'aggregation') {
        lines.push(`${sourceClass.name} o-- ${targetClass.name}`);
      } else if (rel.type === 'dependency') {
        lines.push(`${sourceClass.name} ..> ${targetClass.name}`);
      } else {
        lines.push(`${sourceClass.name} --> ${targetClass.name}`);
      }
    }
  }

  lines.push('@enduml');
  return lines.join('\n');
}

export function generateCode(model, language) {
  const classes = orderedClasses(model.classes, model.relationships);
  const inheritanceRels = model.relationships.filter(r => r.type === 'inheritance' || !r.type);
  const parentOf = item => inheritanceRels.find(x => x.childId === item.id)?.parentId;

  return classes.map(item => {
    const parent = classes.find(x => x.id === parentOf(item));
    if (language === 'python') return generatePython(item, parent, classes);
    if (language === 'cpp') return generateCpp(item, parent);
    const extendsText = parent ? (language === 'csharp' ? ` : ${parent.name}` : ` extends ${parent.name}`) : '';
    const body = [fields(item, language), methods(item, language)].filter(Boolean).join('\n\n');
    return `class ${item.name}${extendsText}\n{\n${body}\n}`;
  }).join('\n\n');
}

export const extensions = { java: 'java', cpp: 'cpp', python: 'py', csharp: 'cs', typescript: 'ts' };

const idFor = name => name.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase());

const parseType = raw => {
  const value = raw.trim();
  const array = value.endsWith('[]') || value.startsWith('std::vector<') || value.startsWith('List[') || value.startsWith('list[');
  return { type: value.replace(/\[\]$/, '').replace(/^std::vector<(.+)>$/, '$1').replace(/^(?:List|list)\[(.+)\]$/, '$1'), array };
};

export function parseCode(source, language) {
  const lines = source.split('\n');
  const classRows = [];
  lines.forEach((line, index) => {
    const match = line.match(/^\s*class\s+(\w+)(?:\s+extends\s+(\w+)|\s*:\s*(?:public\s+)?(\w+)|\s*\((\w+)\))?/);
    if (match) classRows.push({ name: match[1], parent: match[2] || match[3] || match[4], start: index });
  });
  if (!classRows.length) return null;
  const classes = classRows.map((row, index) => {
    const end = classRows[index + 1]?.start || lines.length;
    const attributes = [];
    const methods = [];
    let visibility = 'private';
    for (const line of lines.slice(row.start + 1, end)) {
      const text = line.trim();
      if (/^(public|private|protected|package):?$/.test(text)) { visibility = text.replace(':', ''); continue; }
      const pythonMethod = text.match(/^def\s+(\w+)\(([^)]*)\)/);
      if (pythonMethod) { methods.push({ access: 'public', name: pythonMethod[1], returnType: 'void', params: pythonMethod[2].replace(/^self,?\s*/, '') }); continue; }
      const method = text.match(/^(?:(public|private|protected|package)\s+)?(?:static\s+)?([\w<>:\[\]]+)\s+(\w+)\(([^)]*)\)/);
      if (method) { methods.push({ access: method[1] || visibility, name: method[3], returnType: method[2], params: method[4] }); continue; }
      const typed = text.match(/^(?:(public|private|protected|package)\s+)?([\w<>:\[\]]+)\s+(\w+)\s*;/);
      const typescript = text.match(/^(?:(public|private|protected|package)\s+)?(\w+)\s*:\s*([\w<>:\[\]]+)\s*;/);
      const field = typed || typescript;
      if (field) {
        const parsed = parseType(typed ? field[2] : field[3]);
        attributes.push({ access: field[1] || visibility, name: typed ? field[3] : field[2], type: parsed.type, array: parsed.array });
      }
    }
    return { id: idFor(row.name), name: row.name, attributes, methods };
  });
  const relationships = classRows.filter(row => row.parent).map(row => ({ childId: idFor(row.name), parentId: idFor(row.parent), sourceId: idFor(row.name), targetId: idFor(row.parent), type: 'inheritance' }));
  return { classes, relationships };
}
