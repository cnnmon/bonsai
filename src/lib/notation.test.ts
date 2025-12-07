import { describe, it, expect } from 'vitest';
import { 
  detectPrefix, 
  linesToStructure, 
  structureToLines, 
  EditorLine 
} from './notation';

describe('detectPrefix', () => {
  it('detects narrative lines', () => {
    expect(detectPrefix('- Hello world')).toEqual({ type: 'narrative', content: 'Hello world' });
  });

  it('detects decision lines', () => {
    expect(detectPrefix('* What do you do?')).toEqual({ type: 'decision', content: 'What do you do?' });
  });

  it('detects option lines (-> with space)', () => {
    expect(detectPrefix('-> Ride a bike')).toEqual({ type: 'option', content: 'Ride a bike' });
  });

  it('detects scene labels', () => {
    expect(detectPrefix('FIRE:')).toEqual({ type: 'scene', content: 'FIRE' });
    expect(detectPrefix('START:')).toEqual({ type: 'scene', content: 'START' });
  });
});

describe('linesToStructure - indentation handling', () => {
  it('parses options at indent+1 from decision', () => {
    const lines: EditorLine[] = [
      { id: 'scene', text: 'START:', indent: 0 },
      { id: 'dec', text: '* What do you do?', indent: 0 },
      { id: 'opt1', text: '-> Option A', indent: 1 },
      { id: 'opt2', text: '-> Option B', indent: 1 },
    ];

    const result = linesToStructure(lines);
    expect(result.scenes[0].lines[0].type).toBe('decision');
    
    const decision = result.scenes[0].lines[0];
    if (decision.type === 'decision') {
      expect(decision.options).toHaveLength(2);
      expect(decision.options[0].text).toBe('Option A');
      expect(decision.options[1].text).toBe('Option B');
    }
  });

  it('parses jumps inside options at indent+2', () => {
    const lines: EditorLine[] = [
      { id: 'scene', text: 'START:', indent: 0 },
      { id: 'dec', text: '* What do you do?', indent: 0 },
      { id: 'opt1', text: '-> Ride a bike', indent: 1 },
      { id: 'narr', text: "- That's cool!", indent: 2 },
      { id: 'jump', text: '-> BIKE', indent: 2 },
      { id: 'opt2', text: '-> Learn to sail', indent: 1 },
      { id: 'jump2', text: '-> END', indent: 2 },
    ];

    const result = linesToStructure(lines);
    const decision = result.scenes[0].lines[0];
    
    if (decision.type === 'decision') {
      expect(decision.options).toHaveLength(2);
      
      // First option has narrative + jump
      expect(decision.options[0].text).toBe('Ride a bike');
      expect(decision.options[0].lines).toHaveLength(2);
      expect(decision.options[0].lines[0].type).toBe('narrative');
      expect(decision.options[0].lines[1].type).toBe('jump');
      if (decision.options[0].lines[1].type === 'jump') {
        expect(decision.options[0].lines[1].target).toBe('BIKE');
      }
      
      // Second option has jump only
      expect(decision.options[1].text).toBe('Learn to sail');
      expect(decision.options[1].lines).toHaveLength(1);
      expect(decision.options[1].lines[0].type).toBe('jump');
    }
  });

  it('treats -> at wrong indent as jump, not option', () => {
    const lines: EditorLine[] = [
      { id: 'scene', text: 'START:', indent: 0 },
      { id: 'narr', text: '- Hello', indent: 0 },
      { id: 'jump', text: '-> OTHER_SCENE', indent: 0 },
    ];

    const result = linesToStructure(lines);
    expect(result.scenes[0].lines).toHaveLength(2);
    expect(result.scenes[0].lines[0].type).toBe('narrative');
    expect(result.scenes[0].lines[1].type).toBe('jump');
    if (result.scenes[0].lines[1].type === 'jump') {
      expect(result.scenes[0].lines[1].target).toBe('OTHER_SCENE');
    }
  });

  it('handles the README example correctly', () => {
    // Based on README notation:
    // FIRE:
    // - The fire burns brightly.
    // * What does the player do?
    //   -> Ride a bike
    //     - That's cool!
    //     -> BIKE
    //   -> Learn to sail
    //     -> END
    const lines: EditorLine[] = [
      { id: 's1', text: 'FIRE:', indent: 0 },
      { id: 'n1', text: '- The fire burns brightly.', indent: 0 },
      { id: 'd1', text: '* What does the player do?', indent: 0 },
      { id: 'o1', text: '-> Ride a bike', indent: 1 },
      { id: 'n2', text: "- That's cool!", indent: 2 },
      { id: 'j1', text: '-> BIKE', indent: 2 },
      { id: 'o2', text: '-> Learn to sail', indent: 1 },
      { id: 'j2', text: '-> END', indent: 2 },
      { id: 's2', text: 'BIKE:', indent: 0 },
      { id: 'n3', text: '- Hi', indent: 0 },
      { id: 'j3', text: '-> END', indent: 0 },
    ];

    const result = linesToStructure(lines);
    
    // Check we have 2 scenes
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0].label).toBe('FIRE');
    expect(result.scenes[1].label).toBe('BIKE');
    
    // FIRE scene structure
    expect(result.scenes[0].lines).toHaveLength(2); // narrative + decision
    expect(result.scenes[0].lines[0].type).toBe('narrative');
    expect(result.scenes[0].lines[1].type).toBe('decision');
    
    const decision = result.scenes[0].lines[1];
    if (decision.type === 'decision') {
      expect(decision.prompt).toBe('What does the player do?');
      expect(decision.options).toHaveLength(2);
      
      // Option 1: Ride a bike -> narrative -> jump to BIKE
      expect(decision.options[0].text).toBe('Ride a bike');
      expect(decision.options[0].lines).toHaveLength(2);
      expect(decision.options[0].lines[0].type).toBe('narrative');
      expect(decision.options[0].lines[1].type).toBe('jump');
      if (decision.options[0].lines[1].type === 'jump') {
        expect(decision.options[0].lines[1].target).toBe('BIKE');
      }
      
      // Option 2: Learn to sail -> jump to END
      expect(decision.options[1].text).toBe('Learn to sail');
      expect(decision.options[1].lines).toHaveLength(1);
      if (decision.options[1].lines[0].type === 'jump') {
        expect(decision.options[1].lines[0].target).toBe('END');
      }
    }
    
    // BIKE scene structure
    expect(result.scenes[1].lines).toHaveLength(2); // narrative + jump
    expect(result.scenes[1].lines[0].type).toBe('narrative');
    expect(result.scenes[1].lines[1].type).toBe('jump');
  });
});

describe('structureToLines - roundtrip', () => {
  it('converts structure to lines with correct indentation', () => {
    const structure = {
      startScene: 'START',
      scenes: [{
        label: 'START',
        lines: [
          { type: 'narrative' as const, id: 'n1', text: 'Hello' },
          {
            type: 'decision' as const,
            id: 'd1',
            prompt: 'What do you do?',
            options: [
              {
                id: 'o1',
                text: 'Option A',
                lines: [
                  { type: 'jump' as const, id: 'j1', target: 'END' }
                ]
              }
            ]
          }
        ]
      }]
    };

    const lines = structureToLines(structure);
    
    // Find the relevant lines
    const narrativeLine = lines.find(l => l.text === '- Hello');
    const decisionLine = lines.find(l => l.text === '* What do you do?');
    const optionLine = lines.find(l => l.text === '-> Option A');
    const jumpLine = lines.find(l => l.text === '-> END');
    
    expect(narrativeLine?.indent).toBe(0);
    expect(decisionLine?.indent).toBe(0);
    expect(optionLine?.indent).toBe(1);
    expect(jumpLine?.indent).toBe(2);
  });

  it('roundtrips structure -> lines -> structure', () => {
    const original = {
      startScene: 'FIRE',
      scenes: [{
        label: 'FIRE',
        lines: [
          { type: 'narrative' as const, id: 'n1', text: 'The fire burns.' },
          {
            type: 'decision' as const,
            id: 'd1',
            prompt: 'What do you do?',
            options: [
              {
                id: 'o1',
                text: 'Jump',
                lines: [
                  { type: 'narrative' as const, id: 'n2', text: 'You jumped!' },
                  { type: 'jump' as const, id: 'j1', target: 'END' }
                ]
              },
              {
                id: 'o2',
                text: 'Stay',
                lines: [
                  { type: 'jump' as const, id: 'j2', target: 'FIRE' }
                ]
              }
            ]
          }
        ]
      }]
    };

    const lines = structureToLines(original);
    const roundtripped = linesToStructure(lines);
    
    // Check structure matches
    expect(roundtripped.scenes).toHaveLength(1);
    expect(roundtripped.scenes[0].label).toBe('FIRE');
    expect(roundtripped.scenes[0].lines).toHaveLength(2);
    
    const decision = roundtripped.scenes[0].lines[1];
    if (decision.type === 'decision') {
      expect(decision.options).toHaveLength(2);
      expect(decision.options[0].lines).toHaveLength(2);
      expect(decision.options[1].lines).toHaveLength(1);
    }
  });
});

