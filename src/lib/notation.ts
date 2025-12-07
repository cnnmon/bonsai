import { GameStructure, Scene, Line, Option, NarrativeLine, DecisionLine, JumpLine, LineType } from '../types/game';
import { generateId } from '../components/Editor/utils';

// Editor line representation (flat list for easy editing)
export interface EditorLine {
  id: string;
  text: string;
  indent: number;
}

export function detectPrefix(text: string): { type: LineType; content: string } {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("* ")) return { type: LineType.DECISION, content: trimmed.slice(2) };
  if (trimmed.startsWith("~ ")) return { type: LineType.OPTION, content: trimmed.slice(2) };
  // Legacy: "-> " may represent an option or jump; we classify as OPTION here and will disambiguate by indent later.
  if (trimmed.startsWith("-> ")) return { type: LineType.OPTION, content: trimmed.slice(3) };
  if (trimmed.startsWith("- ")) return { type: LineType.NARRATIVE, content: trimmed.slice(2) };
  if (trimmed.endsWith(":") && !trimmed.includes(" ")) return { type: LineType.SCENE, content: trimmed.slice(0, -1) };
  // Standalone arrow is a jump
  if (trimmed.startsWith("->")) return { type: LineType.JUMP, content: trimmed.slice(2).trim() };
  
  // Default to narrative without prefix
  return { type: LineType.NARRATIVE, content: trimmed };
}

// Convert GameStructure to flat editor lines
export function structureToLines(structure: GameStructure): EditorLine[] {
  const lines: EditorLine[] = [];
  
  const processLine = (line: Line, indent: number) => {
    if (line.type === LineType.NARRATIVE) {
      lines.push({ id: line.id, text: `- ${line.text}`, indent });
    } else if (line.type === LineType.JUMP) {
      lines.push({ id: line.id, text: `-> ${line.target}`, indent });
    } else if (line.type === LineType.DECISION) {
      lines.push({ id: line.id, text: `* ${line.prompt}`, indent });
      for (const opt of line.options) {
        lines.push({ id: opt.id, text: `~ ${opt.text}`, indent: indent + 1 });
        for (const optLine of opt.lines) {
          processLine(optLine, indent + 2);
        }
      }
    }
  };
  
  for (const scene of structure.scenes) {
    lines.push({ id: `scene-${scene.label}`, text: `${scene.label}:`, indent: 0 });
    for (const line of scene.lines) {
      processLine(line, 0);
    }
    lines.push({ id: generateId(), text: '', indent: 0 }); // Empty line between scenes
  }
  
  return lines;
}

// Parse flat editor lines back to GameStructure
// Uses indentation to determine structure:
// - Decision at indent X
// - Options at indent X+1
// - Option content (narratives, jumps) at indent X+2 or more
export function linesToStructure(editorLines: EditorLine[]): GameStructure {
  const scenes: Scene[] = [];
  let currentScene: Scene | null = null;
  let currentDecision: { line: DecisionLine; indent: number } | null = null;
  let currentOption: Option | null = null;
  let i = 0;
  
  const finishOption = () => {
    if (currentOption && currentDecision) {
      currentDecision.line.options.push(currentOption);
      currentOption = null;
    }
  };
  
  const finishDecision = () => {
    finishOption();
    if (currentDecision && currentScene) {
      currentScene.lines.push(currentDecision.line);
      currentDecision = null;
    }
  };
  
  const parseLines = (): void => {
    while (i < editorLines.length) {
      const editorLine = editorLines[i];
      const { type, content } = detectPrefix(editorLine.text);
      const indent = editorLine.indent;

      if (type === LineType.SCENE) {
        finishDecision();
        if (currentScene) {
          scenes.push(currentScene);
        }
        currentScene = { label: content, lines: [] };
        i++;
        continue;
      }
      
      if (!currentScene) {
        currentScene = { label: 'START', lines: [] };
      }
      
      if (type === LineType.DECISION) {
        finishDecision();
        currentDecision = { 
          line: { type: LineType.DECISION, id: editorLine.id, prompt: content, options: [] },
          indent 
        };
        i++;
        continue;
      }
      
      // Check if this is an option (option prefix at decision indent + 1) or a jump
      const isOption = type === LineType.OPTION && 
        currentDecision && 
        indent === currentDecision.indent + 1;
      
      if (isOption) {
        finishOption();
        currentOption = { id: editorLine.id, text: content, lines: [] };
        i++;
        continue;
      }
      
      // Legacy/ambiguous arrow at wrong indent: treat as jump
      if (type === LineType.OPTION) {
        const jumpLine: JumpLine = { type: LineType.JUMP, id: editorLine.id, target: content };
        if (currentOption) {
          currentOption.lines.push(jumpLine);
        } else if (currentDecision) {
          if (indent <= currentDecision.indent) {
            finishDecision();
            currentScene.lines.push(jumpLine);
          } else {
            finishDecision();
            currentScene.lines.push(jumpLine);
          }
        } else {
          currentScene.lines.push(jumpLine);
        }
        i++;
        continue;
      }
      
      if (type === LineType.NARRATIVE) {
        const narrativeLine: NarrativeLine = { type: LineType.NARRATIVE, id: editorLine.id, text: content };
        if (currentOption) {
          currentOption.lines.push(narrativeLine);
        } else if (currentDecision) {
          // Narrative not inside option but after decision - check indent
          if (indent <= currentDecision.indent) {
            // De-indented back, close decision
            finishDecision();
            currentScene.lines.push(narrativeLine);
          } else {
            // Still indented, treat as orphan - close decision
            finishDecision();
            currentScene.lines.push(narrativeLine);
          }
        } else {
          currentScene.lines.push(narrativeLine);
        }
        i++;
        continue;
      }
      
      // Handle jump (-> at wrong indent, or standalone)
      if (type === LineType.JUMP) {
        const jumpLine: JumpLine = { type: LineType.JUMP, id: editorLine.id, target: content };
        if (currentOption) {
          currentOption.lines.push(jumpLine);
        } else if (currentDecision) {
          if (indent <= currentDecision.indent) {
            finishDecision();
            currentScene.lines.push(jumpLine);
          } else {
            // Jump after decision but no option - odd but add to scene
            finishDecision();
            currentScene.lines.push(jumpLine);
          }
        } else {
          currentScene.lines.push(jumpLine);
        }
        i++;
        continue;
      }
      
      i++;
    }
  };
  
  parseLines();
  
  // Finish remaining structures
  finishDecision();
  if (currentScene) {
    scenes.push(currentScene);
  }
  
  return {
    scenes,
    startScene: scenes[0]?.label || 'START',
  };
}

// Slash command definitions
export const SLASH_COMMANDS = [
  { trigger: '/narrative', prefix: '- ', label: 'Narrative', description: 'Story text' },
  { trigger: '/decision', prefix: '* ', label: 'Decision', description: 'Player choice point' },
  { trigger: '/option', prefix: '-> ', label: 'Option', description: 'Choice option' },
  { trigger: '/goto', prefix: '-> ', label: 'Go to', description: 'Jump to scene' },
  { trigger: '/scene', prefix: '', label: 'Scene', description: 'New scene (NAME:)' },
] as const;

export function matchSlashCommand(text: string): typeof SLASH_COMMANDS[number] | null {
  const lower = text.toLowerCase();
  return SLASH_COMMANDS.find(cmd => lower.startsWith(cmd.trigger)) || null;
}

