const accessMap = { '-': 'private', '+': 'public', '#': 'protected', '~': 'package' };

const known = {
  customer: ['Customer', 'customers'], account: ['Account', 'accounts'], transaction: ['Transaction', 'transactions'], payment: ['Payment', 'payments'], user: ['User', 'users'], order: ['Order', 'orders'], product: ['Product', 'products'], employee: ['Employee', 'employees'], bank: ['Bank', 'banks'], vehicle: ['Vehicle', 'vehicles'], animal: ['Animal', 'animals'], dog: ['Dog', 'dogs'], cat: ['Cat', 'cats'], course: ['Course', 'courses'], student: ['Student', 'students'], teacher: ['Teacher', 'teachers'], invoice: ['Invoice', 'invoices'], item: ['Item', 'items'], address: ['Address', 'addresses'], notification: ['Notification', 'notifications'], report: ['Report', 'reports'], profile: ['Profile', 'profiles'],
};

const idFor = name => name.toLowerCase().replace(/[^a-z0-9]+(.)/g, (_, char) => char.toUpperCase());
const emptyClass = (name, index) => ({ id: `${idFor(name)}-${index}`, name, attributes: [], methods: [] });

export function modelFromDescription(text) {
  const lower = text.toLowerCase();
  if (/\bbanking system\b/.test(lower) || (lower.includes('customers') && lower.includes('accounts') && lower.includes('transactions'))) {
    const customer = emptyClass('Customer', 0);
    customer.attributes = [{ access: 'private', name: 'customerId', type: 'int', array: false }, { access: 'private', name: 'name', type: 'String', array: false }, { access: 'private', name: 'email', type: 'String', array: false }];
    customer.methods = [{ access: 'public', name: 'getAccounts', returnType: 'Account[]', params: '' }];
    const account = emptyClass('Account', 1);
    account.attributes = [{ access: 'private', name: 'accountNumber', type: 'String', array: false }, { access: 'private', name: 'balance', type: 'double', array: false }];
    account.methods = [{ access: 'public', name: 'deposit', returnType: 'void', params: 'double amount' }, { access: 'public', name: 'withdraw', returnType: 'void', params: 'double amount' }];
    const transaction = emptyClass('Transaction', 2);
    transaction.attributes = [{ access: 'private', name: 'transactionId', type: 'String', array: false }, { access: 'private', name: 'amount', type: 'double', array: false }, { access: 'private', name: 'timestamp', type: 'DateTime', array: false }];
    transaction.methods = [{ access: 'public', name: 'execute', returnType: 'void', params: '' }];
    return { classes: [customer, account, transaction], relationships: [] };
  }
  const found = Object.entries(known).filter(([word, [, plural]]) => new RegExp(`\\b${word}s?\\b|\\b${plural}\\b`).test(lower)).map(([, [name]]) => name);
  const named = [...text.matchAll(/\b(?:class|entity|model)\s+([A-Z][A-Za-z0-9_]*)/g)].map(match => match[1]);
  const names = [...new Set([...named, ...found])].slice(0, 12);
  const classes = (names.length ? names : ['System']).map((name, index) => emptyClass(name, index));
  classes.forEach(item => {
    const lowerName = item.name.toLowerCase();
    if (lowerName === 'customer' || lowerName === 'user') item.attributes = [{ access: 'private', name: 'id', type: 'int', array: false }, { access: 'private', name: 'name', type: 'String', array: false }];
    if (lowerName === 'account') item.attributes = [{ access: 'private', name: 'accountNumber', type: 'String', array: false }, { access: 'private', name: 'balance', type: 'double', array: false }];
    item.methods = [{ access: 'public', name: lowerName === 'account' ? 'deposit' : 'getDetails', returnType: 'void', params: '' }];
  });
  const relationships = [];
  const link = (child, parent) => {
    const childItem = classes.find(x => x.name === child);
    const parentItem = classes.find(x => x.name === parent);
    if (childItem && parentItem) relationships.push({ parentId: parentItem.id, childId: childItem.id, sourceId: childItem.id, targetId: parentItem.id, type: 'inheritance' });
  };
  if (classes.some(x => x.name === 'Dog') && classes.some(x => x.name === 'Animal')) link('Dog', 'Animal');
  if (classes.some(x => x.name === 'Cat') && classes.some(x => x.name === 'Animal')) link('Cat', 'Animal');
  return { classes, relationships };
}

function parseType(raw) {
  const value = raw.trim();
  const array = value.endsWith('[]');
  return { type: value.replace(/\[\]$/, '') || 'Object', array };
}

export function parseAttributeLine(line) {
  let access = 'private';
  let rest = line.trim();

  const visMatch = rest.match(/^([-+#~])\s*/);
  if (visMatch) {
    access = accessMap[visMatch[1]] || 'private';
    rest = rest.slice(visMatch[0].length).trim();
  }

  // Handle name: type or type name: type
  const colonMatch = rest.match(/^(?:([\w<>.[\]]+)\s+)?(\w+)\s*:\s*([\w<>.[\]]+)$/);
  if (colonMatch) {
    const name = colonMatch[2];
    const parsedType = parseType(colonMatch[3]);
    return { access, name, type: parsedType.type, array: parsedType.array };
  }

  // Handle type name
  const spaceMatch = rest.match(/^([\w<>.[\]]+)\s+(\w+)$/);
  if (spaceMatch) {
    const parsedType = parseType(spaceMatch[1]);
    const name = spaceMatch[2];
    return { access, name, type: parsedType.type, array: parsedType.array };
  }

  if (/^\w+$/.test(rest)) {
    return { access, name: rest, type: 'String', array: false };
  }

  return null;
}

export function parseMethodLine(line) {
  let access = 'public';
  let rest = line.trim();

  const visMatch = rest.match(/^([-+#~])\s*/);
  if (visMatch) {
    access = accessMap[visMatch[1]] || 'public';
    rest = rest.slice(visMatch[0].length).trim();
  }

  const methodMatch = rest.match(/^(\w+)\s*\(([^)]*)\)(?:\s*:\s*([\w<>.[\]]+))?$/);
  if (methodMatch) {
    const name = methodMatch[1];
    const params = methodMatch[2].trim();
    const returnType = methodMatch[3] ? methodMatch[3].trim() : 'void';
    return { access, name, returnType, params };
  }

  const prefixTypeMatch = rest.match(/^([\w<>.[\]]+)\s+(\w+)\s*\(([^)]*)\)$/);
  if (prefixTypeMatch) {
    const returnType = prefixTypeMatch[1].trim();
    const name = prefixTypeMatch[2].trim();
    const params = prefixTypeMatch[3].trim();
    return { access, name, returnType, params };
  }

  return null;
}

export function parseRelationshipArrow(arrow) {
  const norm = arrow.trim();
  if (norm.includes('<|--') || norm.includes('<|..')) return { type: 'inheritance', dir: 'left-parent' };
  if (norm.includes('--|>') || norm.includes('..|>')) return { type: 'inheritance', dir: 'right-parent' };
  if (norm.includes('*--')) return { type: 'composition', dir: 'left-source' };
  if (norm.includes('--*')) return { type: 'composition', dir: 'right-source' };
  if (norm.includes('o--')) return { type: 'aggregation', dir: 'left-source' };
  if (norm.includes('--o')) return { type: 'aggregation', dir: 'right-source' };
  if (norm.includes('..>') || norm.includes('<..')) {
    const dir = norm.includes('<..') ? 'right-source' : 'left-source';
    return { type: 'dependency', dir };
  }
  if (norm.includes('<--') || norm.includes('<-')) return { type: 'association', dir: 'right-source' };
  return { type: 'association', dir: 'left-source' };
}

function toCamelCase(text) {
  const clean = text.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  if (!clean) return 'execute';
  const words = clean.split(/\s+/).filter(Boolean);
  if (!words.length) return 'execute';
  const first = words[0].toLowerCase();
  const rest = words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
  return first + rest;
}

export function parseUml(source) {
  source = source.replace(/^\s*```[^\n]*$/gm, '');

  const classesMap = new Map();
  const rawRelationships = [];
  const participantAliasMap = new Map();

  const getClass = name => {
    const cleanName = name.replace(/["']/g, '').trim();
    if (!classesMap.has(cleanName)) {
      const index = classesMap.size;
      classesMap.set(cleanName, emptyClass(cleanName, index));
    }
    return classesMap.get(cleanName);
  };

  const lines = source.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("'"));

  // Check if sequence diagram features exist
  const isSequenceDiagram = !/\bclass\b/i.test(source) && lines.some(line =>
    /^(?:actor|participant|boundary|control|entity|database|collections|queue)\b/i.test(line) ||
    /^\s*["']?[\w\s]+?["']?\s*(?:->|-->|->>|-->>|\\->)\s*["']?[\w\s]+?["']?\s*:/i.test(line)
  );

  if (isSequenceDiagram) {
    // 1. Extract explicit participants
    lines.forEach(line => {
      const partMatch = line.match(/^(actor|participant|boundary|control|entity|database|collections|queue)\s+(?:"([^"]+)"|([A-Za-z0-9_]+))(?:\s+as\s+([A-Za-z0-9_]+))?/i);
      if (partMatch) {
        const rawName = partMatch[2] || partMatch[3];
        const alias = partMatch[4] || rawName;
        const className = alias.replace(/[^A-Za-z0-9_]/g, '') || 'Participant';
        getClass(className);
        participantAliasMap.set(rawName, className);
        participantAliasMap.set(alias, className);
        participantAliasMap.set(`"${rawName}"`, className);
      }
    });

    // 2. Extract sequence messages
    lines.forEach(line => {
      const seqMsgMatch = line.match(/^["']?([\w\s]+?)["']?\s*(->|-->|->>|-->>|\\->)\s*["']?([\w\s]+?)["']?(?:\s*:\s*(.+))?$/);
      if (seqMsgMatch) {
        const rawSender = seqMsgMatch[1].trim();
        const arrow = seqMsgMatch[2].trim();
        const rawReceiver = seqMsgMatch[3].trim();
        const messageText = seqMsgMatch[4] ? seqMsgMatch[4].trim() : '';

        const senderName = participantAliasMap.get(rawSender) || rawSender.replace(/[^A-Za-z0-9_]/g, '');
        const receiverName = participantAliasMap.get(rawReceiver) || rawReceiver.replace(/[^A-Za-z0-9_]/g, '');

        if (!senderName || !receiverName) return;

        const senderClass = getClass(senderName);
        const receiverClass = getClass(receiverName);

        const isReturnArrow = arrow.includes('--');

        if (messageText && !isReturnArrow) {
          let method;
          if (messageText.includes('(')) {
            method = parseMethodLine(messageText);
          } else {
            const methodName = toCamelCase(messageText);
            method = { access: 'public', name: methodName, returnType: 'void', params: '' };
          }
          if (method && !receiverClass.methods.some(m => m.name === method.name)) {
            receiverClass.methods.push(method);
          }
        }

        if (senderName !== receiverName && !isReturnArrow) {
          const exists = rawRelationships.some(r => r.sourceId === senderName && r.targetId === receiverName);
          if (!exists) {
            rawRelationships.push({
              parentId: senderName,
              childId: receiverName,
              sourceId: senderName,
              targetId: receiverName,
              type: 'association',
              arrow: '-->'
            });
          }
        }
      }
    });

    const classes = Array.from(classesMap.values());
    if (!classes.length) return null;
    return parseJson(JSON.stringify({ classes, relationships: rawRelationships }));
  }

  // 1. Extract class blocks { ... }
  const blockRegex = /(?:class|abstract\s+class|interface)\s+["']?(\w+)["']?\s*(?:<[^>]+>)?\s*\{([\s\S]*?)\}/gi;
  let match;
  while ((match = blockRegex.exec(source)) !== null) {
    const className = match[1];
    const body = match[2];
    const item = getClass(className);

    body.split(/\r?\n|;/).map(l => l.trim()).filter(l => l && !l.startsWith("'")).forEach(line => {
      if (line.includes('(')) {
        const method = parseMethodLine(line);
        if (method) item.methods.push(method);
      } else {
        const attribute = parseAttributeLine(line);
        if (attribute) item.attributes.push(attribute);
      }
    });
  }

  // Remove block definitions from source to avoid double parsing outside lines
  const sourceNoBlocks = source.replace(blockRegex, '');

  // 2. Parse outside lines
  const outsideLines = sourceNoBlocks.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("'"));

  outsideLines.forEach(line => {
    // Ignore directives
    if (/^@startuml|^@enduml|^title\b|^skinparam\b|^package\b|^namespace\b|^hide\b|^show\b/i.test(line)) {
      return;
    }

    // Check relationship lines: e.g. Student --> StudentAPI or Student <|-- GraduateStudent
    const relMatch = line.match(/^["']?(\w+)["']?\s*([<>\-*.#o|]{1,10}(?:\[[^\]]*\])?[<>\-*.#o|]{1,10})\s*["']?(\w+)["']?(?:\s*:\s*(.+))?$/);
    if (relMatch) {
      const leftName = relMatch[1];
      const arrow = relMatch[2];
      const rightName = relMatch[3];

      getClass(leftName);
      getClass(rightName);

      const parsedArrow = parseRelationshipArrow(arrow);
      let sourceId, targetId, parentId, childId;

      if (parsedArrow.type === 'inheritance') {
        if (parsedArrow.dir === 'left-parent') {
          parentId = leftName;
          childId = rightName;
          sourceId = childId;
          targetId = parentId;
        } else {
          parentId = rightName;
          childId = leftName;
          sourceId = childId;
          targetId = parentId;
        }
      } else {
        if (parsedArrow.dir === 'left-source') {
          sourceId = leftName;
          targetId = rightName;
        } else {
          sourceId = rightName;
          targetId = leftName;
        }
        parentId = sourceId;
        childId = targetId;
      }

      rawRelationships.push({
        parentId,
        childId,
        sourceId,
        targetId,
        type: parsedArrow.type,
        arrow
      });
      return;
    }

    // Check single class line: e.g. class Student
    const singleClassMatch = line.match(/^(?:class|abstract\s+class|interface)\s+["']?(\w+)["']?/i);
    if (singleClassMatch) {
      getClass(singleClassMatch[1]);
      return;
    }

    // Check line member assignment: e.g. Student : - int studentId
    const memberMatch = line.match(/^["']?(\w+)["']?\s*:\s*(.+)$/);
    if (memberMatch) {
      const item = getClass(memberMatch[1]);
      const memberLine = memberMatch[2].trim();
      if (memberLine.includes('(')) {
        const method = parseMethodLine(memberLine);
        if (method) item.methods.push(method);
      } else {
        const attribute = parseAttributeLine(memberLine);
        if (attribute) item.attributes.push(attribute);
      }
    }
  });

  const classes = Array.from(classesMap.values());
  if (!classes.length) return null;

  return parseJson(JSON.stringify({ classes, relationships: rawRelationships }));
}

export function parseJson(source) {
  const data = JSON.parse(source);
  if (!data || !Array.isArray(data.classes) || !data.classes.length) {
    throw new Error('JSON must contain a non-empty classes array.');
  }
  const isText = value => value === undefined || typeof value === 'string';
  const validAccess = value => value === undefined || ['public', 'private', 'protected', 'package'].includes(value);

  for (const item of data.classes) {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || !isText(item.id)) {
      throw new Error('Each class needs a name and an optional string ID.');
    }
    for (const key of ['attributes', 'methods']) {
      if (item[key] !== undefined && !Array.isArray(item[key])) {
        throw new Error(`${item.name}.${key} must be an array.`);
      }
      for (const field of item[key] || []) {
        if (!field || !['name', 'type', 'returnType', 'params'].every(k => isText(field[k])) || !validAccess(field.access)) {
          throw new Error(`Invalid ${key} in ${item.name}. Use string names, types, and params, and public/private/protected/package access.`);
        }
      }
    }
  }

  if (data.relationships !== undefined && !Array.isArray(data.relationships)) {
    throw new Error('relationships must be an array.');
  }

  const classes = data.classes.map((item, index) => ({
    id: item.id || `${idFor(item.name || 'Class')}-${index}`,
    name: item.name || `Class${index + 1}`,
    attributes: (item.attributes || []).map(attribute => ({
      access: attribute.access || 'private',
      name: attribute.name || '',
      type: attribute.type || 'Object',
      array: Boolean(attribute.array)
    })),
    methods: (item.methods || []).map(method => ({
      access: method.access || 'public',
      name: method.name || '',
      returnType: method.returnType || 'void',
      params: method.params || ''
    }))
  }));

  if (new Set(classes.map(item => item.id)).size !== classes.length || new Set(classes.map(item => item.name)).size !== classes.length) {
    throw new Error('Class names and IDs must be unique.');
  }

  const resolveId = value => {
    if (!value) return undefined;
    const found = classes.find(item => item.id === value) ||
                  classes.find(item => item.name === value) ||
                  classes.find(item => item.name.toLowerCase() === String(value).toLowerCase());
    return found?.id;
  };

  const relationships = (data.relationships || []).map(item => {
    if (!item) throw new Error('Invalid relationship.');
    const parentId = resolveId(item.parentId || item.sourceId);
    const childId = resolveId(item.childId || item.targetId);
    if (!parentId || !childId || parentId === childId) throw new Error('Invalid relationship.');
    return {
      ...item,
      parentId,
      childId,
      sourceId: resolveId(item.sourceId) || parentId,
      targetId: resolveId(item.targetId) || childId,
      type: item.type || (item.parentId && item.childId ? 'inheritance' : 'association')
    };
  });

  const inheritanceRels = relationships.filter(r => r.type === 'inheritance');
  if (new Set(inheritanceRels.map(item => item.childId)).size !== inheritanceRels.length) {
    throw new Error('Each class can have only one parent.');
  }

  for (const item of classes) {
    const seen = new Set();
    let id = item.id;
    while (id) {
      if (seen.has(id)) throw new Error('Inheritance cannot contain a cycle.');
      seen.add(id);
      id = inheritanceRels.find(relation => relation.childId === id)?.parentId;
    }
  }

  return { classes, relationships };
}
