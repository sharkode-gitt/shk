import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadRoster } from '../../src/characters/roster.ts';

// The characters that ship with the project: each must load, have a complete model and a voice slot.
const roster = loadRoster('assets');
const voices = JSON.parse(readFileSync('assets/voices.json', 'utf8')) as Record<string, string>;

test('the shipped roster loads and includes Emily and the six characters added from Roblox Studio exports', () => {
  for (const id of ['emily', 'bacon', 'ben', 'fzk', 'lexi', 'lokii', 'sammy']) assert.ok(roster[id], `missing ${id}`);
});

test('every character has all its model files, 15 body parts, and a voice id', () => {
  for (const [id, c] of Object.entries(roster)) {
    const dir = `assets/characters/${id}`;
    for (const f of [c.model.obj, c.model.mtl, c.model.atlas, 'parts.json']) assert.ok(existsSync(`${dir}/${f}`), `${id}: ${f}`);
    const parts = JSON.parse(readFileSync(`${dir}/parts.json`, 'utf8')) as { groups: Record<string, { part?: string }> };
    const bodyParts = Object.values(parts.groups).filter((g) => g.part);
    assert.equal(new Set(bodyParts.map((g) => g.part)).size, 15, `${id}: body parts`);
    assert.ok(voices[id], `${id}: no voice id in assets/voices.json`);
  }
});

test('faces: Emily keeps her own style; models that bring their own head texture are left as they are', () => {
  assert.equal(roster.emily.model.face.style, 'emily');
  for (const id of ['fzk', 'lexi', 'lokii']) assert.equal(roster[id].model.face.style, 'none', id);
  for (const id of ['bacon', 'sammy']) assert.equal(roster[id].model.face.style, 'emily', id); // their painted face is cleared
  assert.equal(roster.ben.model.face.style, 'classic');
});
