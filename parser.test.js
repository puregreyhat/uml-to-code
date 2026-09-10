import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUml, parseAttributeLine, parseMethodLine } from './src/importers.js';
import { generateCode } from './src/generators.js';

test('parseAttributeLine supports all syntax variations and visibilities', () => {
  const c1 = parseAttributeLine('int id');
  assert.deepEqual(c1, { access: 'private', name: 'id', type: 'int', array: false });

  const c2 = parseAttributeLine('String name');
  assert.deepEqual(c2, { access: 'private', name: 'name', type: 'String', array: false });

  const c3 = parseAttributeLine('- String email');
  assert.deepEqual(c3, { access: 'private', name: 'email', type: 'String', array: false });

  const c4 = parseAttributeLine('+ String email');
  assert.deepEqual(c4, { access: 'public', name: 'email', type: 'String', array: false });

  const c5 = parseAttributeLine('# String email');
  assert.deepEqual(c5, { access: 'protected', name: 'email', type: 'String', array: false });

  const c6 = parseAttributeLine('~ String email');
  assert.deepEqual(c6, { access: 'package', name: 'email', type: 'String', array: false });

  const c7 = parseAttributeLine('String email: String');
  assert.equal(c7.name, 'email');
  assert.equal(c7.type, 'String');

  const c8 = parseAttributeLine('- name: String');
  assert.deepEqual(c8, { access: 'private', name: 'name', type: 'String', array: false });
});

test('parseMethodLine supports visibility, parameters, and return types', () => {
  const m1 = parseMethodLine('+ login(): boolean');
  assert.deepEqual(m1, { access: 'public', name: 'login', returnType: 'boolean', params: '' });

  const m2 = parseMethodLine('+ register(name: String): void');
  assert.deepEqual(m2, { access: 'public', name: 'register', returnType: 'void', params: 'name: String' });

  const m3 = parseMethodLine('+ findByEmail(email: String): Student');
  assert.deepEqual(m3, { access: 'public', name: 'findByEmail', returnType: 'Student', params: 'email: String' });

  const m4 = parseMethodLine('- validate(data: String): boolean');
  assert.deepEqual(m4, { access: 'private', name: 'validate', returnType: 'boolean', params: 'data: String' });

  const m5 = parseMethodLine('~ handleInternal(code: int): boolean');
  assert.deepEqual(m5, { access: 'package', name: 'handleInternal', returnType: 'boolean', params: 'code: int' });
});

test('parseUml parses complete Student Registration System example correctly', () => {
  const uml = `
@startuml
title Student Registration System

class Student {
    - int studentId
    - String name
    - String email
    - String password

    + register(): void
    + login(): boolean
}

class StudentAPI {
    + registerStudent(student: Student): String
    + validateStudent(student: Student): boolean
}

class AuthService {
    + hashPassword(password: String): String
    + verifyPassword(password: String, hash: String): boolean
}

class StudentRepository {
    + saveStudent(student: Student): void
    + findStudent(email: String): Student
}

class Database {
    + connect(): void
    + insertStudent(student: Student): void
    + findByEmail(email: String): Student
}

Student --> StudentAPI
StudentAPI --> AuthService
StudentAPI --> StudentRepository
StudentRepository --> Database

@enduml
`;

  const model = parseUml(uml);
  assert.ok(model);
  assert.equal(model.classes.length, 5);

  const student = model.classes.find(c => c.name === 'Student');
  assert.ok(student);
  assert.equal(student.attributes.length, 4);
  assert.deepEqual(student.attributes[0], { access: 'private', name: 'studentId', type: 'int', array: false });
  assert.deepEqual(student.attributes[1], { access: 'private', name: 'name', type: 'String', array: false });
  assert.deepEqual(student.attributes[2], { access: 'private', name: 'email', type: 'String', array: false });
  assert.deepEqual(student.attributes[3], { access: 'private', name: 'password', type: 'String', array: false });

  assert.equal(student.methods.length, 2);
  assert.deepEqual(student.methods[0], { access: 'public', name: 'register', returnType: 'void', params: '' });
  assert.deepEqual(student.methods[1], { access: 'public', name: 'login', returnType: 'boolean', params: '' });

  assert.equal(model.relationships.length, 4);
  assert.equal(model.relationships[0].type, 'association');
  assert.equal(model.relationships[1].type, 'association');
  assert.equal(model.relationships[2].type, 'association');
  assert.equal(model.relationships[3].type, 'association');

  const javaCode = generateCode(model, 'java');
  assert.match(javaCode, /class Student\n\{/);
  assert.match(javaCode, /private int studentId;/);
  assert.match(javaCode, /public void register\(\) \{ \}/);
  assert.match(javaCode, /public String registerStudent\(Student student\) \{ \}/);
  assert.match(javaCode, /public boolean verifyPassword\(String password, String hash\) \{ \}/);
});

test('parseUml supports inheritance, composition, aggregation, and dependency', () => {
  const uml = `
@startuml
class Parent
class Child
class Component
class Container
class Room
class House
class Service
class Client

Child <|-- Parent
Container *-- Component
House o-- Room
Client ..> Service
@enduml
`;

  const model = parseUml(uml);
  assert.ok(model);
  assert.equal(model.classes.length, 8);
  assert.equal(model.relationships.length, 4);

  const inheritance = model.relationships.find(r => r.type === 'inheritance');
  assert.ok(inheritance);

  const composition = model.relationships.find(r => r.type === 'composition');
  assert.ok(composition);

  const aggregation = model.relationships.find(r => r.type === 'aggregation');
  assert.ok(aggregation);

  const dependency = model.relationships.find(r => r.type === 'dependency');
  assert.ok(dependency);
});

test('parseUml parses PlantUML sequence diagrams into classes and methods', () => {
  const sequenceUml = `
@startuml
actor Student
participant "Web App" as Frontend
participant "REST API" as API
participant "Authentication Service" as Auth
database "MySQL Database" as DB

Student -> Frontend: Open registration page
Frontend -> API: POST /api/students
API -> Auth: Hash password
API -> DB: Check existing email
@enduml
`;

  const model = parseUml(sequenceUml);
  assert.ok(model);
  assert.equal(model.classes.length, 5);
  const frontend = model.classes.find(c => c.name === 'Frontend');
  assert.ok(frontend);
  assert.equal(frontend.methods[0].name, 'openRegistrationPage');
});
