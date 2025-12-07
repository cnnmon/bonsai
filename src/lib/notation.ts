import {
  GameStructure,
  Scene,
  Line,
  Option,
  NarrativeLine,
  DecisionLine,
  JumpLine,
  PromptLine,
  LineType,
} from "../types/game";
import { generateId } from "../components/Editor/utils";
import { formatOptionTexts, parseOptionTexts } from "./options";

// Editor line representation (flat list for easy editing)
export interface EditorLine {
  id: string;
  text: string;
  indent: number;
}

export function detectPrefix(text: string): { type: LineType; content: string } {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("# ")) return { type: LineType.SCENE, content: trimmed.slice(2) };
  if (trimmed.startsWith("? ")) return { type: LineType.DECISION, content: trimmed.slice(2) };
  if (trimmed.startsWith("* ")) return { type: LineType.OPTION, content: trimmed.slice(2) };
  if (trimmed.startsWith("↗ ")) return { type: LineType.JUMP, content: trimmed.slice(2) };
  if (trimmed.startsWith("! ")) return { type: LineType.PROMPT, content: trimmed.slice(2) };
  if (trimmed.startsWith("- ")) return { type: LineType.NARRATIVE, content: trimmed.slice(2) };
  
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
      lines.push({ id: line.id, text: `↗ ${line.target}`, indent });
    } else if (line.type === LineType.PROMPT) {
      lines.push({ id: line.id, text: `! ${line.text}`, indent });
    } else if (line.type === LineType.DECISION) {
      lines.push({ id: line.id, text: `? ${line.prompt}`, indent });
      for (const opt of line.options) {
        lines.push({
          id: opt.id,
          text: `* ${formatOptionTexts(opt.texts)}`,
          indent: indent + 1,
        });
        for (const optLine of opt.lines) {
          processLine(optLine, indent + 2);
        }
      }
    }
  };
  
  for (const scene of structure.scenes) {
    lines.push({ id: `scene-${scene.label}`, text: `# ${scene.label}`, indent: 0 });
    for (const line of scene.lines) {
      processLine(line, 0);
    }
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
        // Don't push the temporary START scene if it's empty
        if (currentScene && !(currentScene.label === 'START' && currentScene.lines.length === 0)) {
          scenes.push(currentScene);
        }
        currentScene = { label: content, lines: [] };
        i++;
        continue;
      }
      
      if (!currentScene) {
        // Skip lines before first scene header
        i++;
        continue;
      }
      
      if (type === LineType.DECISION) {
        finishDecision();
        // Don't create decisions in pre-scene area; they'll be added to first scene
        currentDecision = { 
          line: { type: LineType.DECISION, id: editorLine.id, prompt: content, options: [] },
          indent 
        };
        i++;
        continue;
      }
      
      // Check if this is an option (option prefix at decision indent + 1) or a jump
      const isOption =
        type === LineType.OPTION &&
        currentDecision &&
        indent === currentDecision.indent + 1;
      
      if (isOption) {
        finishOption();
        currentOption = {
          id: editorLine.id,
          texts: parseOptionTexts(content),
          lines: [],
        };
        i++;
        continue;
      }
      
      // Legacy/ambiguous arrow at wrong indent: treat as jump
      if (type === LineType.OPTION) {
        const jumpLine: JumpLine = { type: LineType.JUMP, id: editorLine.id, target: content };
        
        // Check if we need to close decision due to de-indentation
        if (currentDecision && indent <= currentDecision.indent) {
          finishDecision();
          currentScene.lines.push(jumpLine);
        } else if (currentOption) {
          currentOption.lines.push(jumpLine);
        } else if (currentDecision) {
          finishDecision();
          currentScene.lines.push(jumpLine);
        } else {
          currentScene.lines.push(jumpLine);
        }
        i++;
        continue;
      }
      
      if (type === LineType.NARRATIVE) {
        const narrativeLine: NarrativeLine = { type: LineType.NARRATIVE, id: editorLine.id, text: content };
        
        // Check if we need to close decision due to de-indentation
        if (currentDecision && indent <= currentDecision.indent) {
          // De-indented back to decision level or less, close everything
          finishDecision();
          currentScene.lines.push(narrativeLine);
        } else if (currentOption) {
          // Inside an option and properly indented
          currentOption.lines.push(narrativeLine);
        } else if (currentDecision) {
          // After decision but no option - orphan, close decision
          finishDecision();
          currentScene.lines.push(narrativeLine);
        } else {
          // No decision context
          currentScene.lines.push(narrativeLine);
        }
        i++;
        continue;
      }
      
      if (type === LineType.PROMPT) {
        const promptLine: PromptLine = { type: LineType.PROMPT, id: editorLine.id, text: content };
        
        // Check if we need to close decision due to de-indentation
        if (currentDecision && indent <= currentDecision.indent) {
          finishDecision();
          currentScene.lines.push(promptLine);
        } else if (currentOption) {
          currentOption.lines.push(promptLine);
        } else if (currentDecision) {
          finishDecision();
          currentScene.lines.push(promptLine);
        } else {
          currentScene.lines.push(promptLine);
        }
        i++;
        continue;
      }
      
      // Handle jump (-> at wrong indent, or standalone)
      if (type === LineType.JUMP) {
        const jumpLine: JumpLine = { type: LineType.JUMP, id: editorLine.id, target: content };
        
        // Check if we need to close decision due to de-indentation
        if (currentDecision && indent <= currentDecision.indent) {
          finishDecision();
          currentScene.lines.push(jumpLine);
        } else if (currentOption) {
          currentOption.lines.push(jumpLine);
        } else if (currentDecision) {
          // Jump after decision but no option - close decision
          finishDecision();
          currentScene.lines.push(jumpLine);
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
  { trigger: '/decision', prefix: '? ', label: 'Decision', description: 'Player choice point' },
  { trigger: '/option', prefix: '* ', label: 'Option', description: 'Choice option' },
  { trigger: '/goto', prefix: '↗ ', label: 'Go to', description: 'Jump to scene' },
  { trigger: '/prompt', prefix: '! ', label: 'Prompt', description: 'AI generation instruction' },
  { trigger: '/scene', prefix: '# ', label: 'Scene', description: 'New scene' },
] as const;

export function matchSlashCommand(text: string): typeof SLASH_COMMANDS[number] | null {
  const lower = text.toLowerCase();
  return SLASH_COMMANDS.find(cmd => lower.startsWith(cmd.trigger)) || null;
}

