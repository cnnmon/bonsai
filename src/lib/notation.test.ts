import { describe, it, expect } from 'vitest';
import { linesToStructure, EditorLine } from './notation';
import { LineType } from '../types/game';

describe('linesToStructure', () => {
  it('excludes lines before first scene header', () => {
    const editorLines: EditorLine[] = [
      { id: '1', text: '- Opening narrative', indent: 0 },
      { id: '2', text: '! A global prompt', indent: 0 },
      { id: '3', text: '# FIRST_SCENE', indent: 0 },
      { id: '4', text: '- Scene content', indent: 0 },
      { id: '5', text: '? What do you do?', indent: 0 },
    ];

    const structure = linesToStructure(editorLines);

    expect(structure.scenes).toHaveLength(1);
    expect(structure.scenes[0].label).toBe('FIRST_SCENE');
    expect(structure.scenes[0].lines).toHaveLength(2);
    
    // Only scene-specific lines (after header) should be included
    expect(structure.scenes[0].lines[0].type).toBe(LineType.NARRATIVE);
    expect(structure.scenes[0].lines[0]).toHaveProperty('text', 'Scene content');
    
    expect(structure.scenes[0].lines[1].type).toBe(LineType.DECISION);
    expect(structure.scenes[0].lines[1]).toHaveProperty('prompt', 'What do you do?');
  });

  it('skips all lines when no scene header present', () => {
    const editorLines: EditorLine[] = [
      { id: '1', text: '- Just a narrative', indent: 0 },
      { id: '2', text: '? A decision', indent: 0 },
    ];

    const structure = linesToStructure(editorLines);

    // Lines without a scene header are skipped entirely
    expect(structure.scenes).toHaveLength(0);
    expect(structure.startScene).toBe('START');
  });

  it('does not create empty START scene when first line is scene header', () => {
    const editorLines: EditorLine[] = [
      { id: '1', text: '# FIRST_SCENE', indent: 0 },
      { id: '2', text: '- Content', indent: 0 },
    ];

    const structure = linesToStructure(editorLines);

    expect(structure.scenes).toHaveLength(1);
    expect(structure.scenes[0].label).toBe('FIRST_SCENE');
    expect(structure.scenes[0].lines).toHaveLength(1);
  });

  it('handles jump to END in notation', () => {
    const editorLines: EditorLine[] = [
      { id: '1', text: '# START', indent: 0 },
      { id: '2', text: '- Beginning', indent: 0 },
      { id: '3', text: '↗ END', indent: 0 },
      { id: '4', text: '- Should not be reachable', indent: 0 },
    ];

    const structure = linesToStructure(editorLines);

    expect(structure.scenes).toHaveLength(1);
    expect(structure.scenes[0].lines).toHaveLength(3);
    expect(structure.scenes[0].lines[1].type).toBe(LineType.JUMP);
    expect(structure.scenes[0].lines[1]).toHaveProperty('target', 'END');
  });

  it('places de-indented narrative after decision, not inside last option', () => {
    const editorLines: EditorLine[] = [
      { id: '1', text: '# scene', indent: 0 },
      { id: '2', text: '- what is going on?', indent: 0 },
      { id: '3', text: '? something comes closer...', indent: 0 },
      { id: '4', text: '* cower', indent: 1 },
      { id: '5', text: '- okay', indent: 2 },
      { id: '6', text: '* fight', indent: 1 },
      { id: '7', text: '- sure', indent: 2 },
      { id: '8', text: '* sneak away', indent: 1 },
      { id: '9', text: '↗ SNEAK_AWAY', indent: 2 },
      { id: '10', text: '- it doesn\'t matter either way.', indent: 0 },
    ];

    const structure = linesToStructure(editorLines);

    expect(structure.scenes).toHaveLength(1);
    expect(structure.scenes[0].lines).toHaveLength(3);
    
    // Line 0: first narrative
    expect(structure.scenes[0].lines[0].type).toBe(LineType.NARRATIVE);
    expect(structure.scenes[0].lines[0]).toHaveProperty('text', 'what is going on?');
    
    // Line 1: decision with 3 options
    expect(structure.scenes[0].lines[1].type).toBe(LineType.DECISION);
    const decision = structure.scenes[0].lines[1];
    if (decision.type === LineType.DECISION) {
      expect(decision.options).toHaveLength(3);
      expect(decision.options[0].lines).toHaveLength(1); // cower -> okay
      expect(decision.options[1].lines).toHaveLength(1); // fight -> sure
      expect(decision.options[2].lines).toHaveLength(1); // sneak away -> jump
    }
    
    // Line 2: narrative AFTER decision (not inside any option)
    expect(structure.scenes[0].lines[2].type).toBe(LineType.NARRATIVE);
    expect(structure.scenes[0].lines[2]).toHaveProperty('text', 'it doesn\'t matter either way.');
  });
});

