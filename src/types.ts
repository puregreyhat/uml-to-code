export type Visibility = 'public' | 'private' | 'protected' | 'package';

export interface Attribute {
  access: Visibility;
  name: string;
  type: string;
  array?: boolean;
}

export interface Method {
  access: Visibility;
  name: string;
  returnType: string;
  params: string;
}

export type RelationshipType = 'inheritance' | 'association' | 'composition' | 'aggregation' | 'dependency';

export interface Relationship {
  parentId: string;
  childId: string;
  sourceId?: string;
  targetId?: string;
  type?: RelationshipType;
  arrow?: string;
}

export interface UMLClass {
  id: string;
  name: string;
  attributes: Attribute[];
  methods: Method[];
}

export interface UMLModel {
  classes: UMLClass[];
  relationships: Relationship[];
}
