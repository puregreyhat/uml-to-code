import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutDiagram, methodLabel } from './src/diagramLayout.js';

test('banking hierarchy fits every class and member without overlapping', () => {
  const names = ['Customer', 'Account', 'Transaction', 'SavingsAccount', 'CheckingAccount', 'DepositTransaction', 'WithdrawalTransaction'];
  const classes = names.map(name => ({id:name,name,attributes:Array.from({length:6},(_,i)=>({name:`field${i}`,type:'String'})),methods:Array.from({length:5},(_,i)=>({name:`method${i}`,params:'accountNumber: String, amount: double',returnType:'boolean'}))}));
  const relationships = [['Account','SavingsAccount'],['Account','CheckingAccount'],['Transaction','DepositTransaction'],['Transaction','WithdrawalTransaction']].map(([parentId,childId])=>({parentId,childId}));
  const {nodes,width,height}=layoutDiagram(classes,relationships);
  for(const a of nodes.values()) {
    assert.ok(a.x >= 0 && a.y >= 0 && a.x+a.width <= width && a.y+a.height <= height);
    assert.ok(a.divider+22*5 < a.height);
    for(const b of nodes.values()) if(a!==b) assert.ok(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y);
  }
  for(const {parentId,childId} of relationships) assert.ok(nodes.get(parentId).y+nodes.get(parentId).height < nodes.get(childId).y);
  assert.match(methodLabel(classes[0].methods[0]), /accountNumber: String, amount: double/);
  assert.doesNotThrow(()=>layoutDiagram(classes,[{parentId:'Account',childId:'Customer'},{parentId:'Customer',childId:'Account'}]));
});
