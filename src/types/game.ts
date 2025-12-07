export enum LineType {
  NARRATIVE = 'narrative',
  JUMP = 'goto',
  DECISION = 'decision',
  OPTION = 'option',
  SCENE = 'scene',
}

export interface NarrativeLine {
  type: LineType.NARRATIVE;
  id: string;
  text: string;
}

export interface JumpLine {
  type: LineType.JUMP;
  id: string;
  target: string; // Scene label or 'END'
}

export interface Option {
  id: string;
  /**
   * Primary text first, followed by confirmed similar variants.
   */
  texts: string[];
  lines: Line[];
}

export interface DecisionLine {
  type: LineType.DECISION;
  id: string;
  prompt: string;
  options: Option[];
}

// Future: VariableLine for [+ SWORD], [HAPPINESS += 10], etc.
// export interface VariableLine {
//   type: 'variable';
//   id: string;
//   action: 'set' | 'add' | 'remove' | 'check';
//   variable: string;
//   value?: number | boolean;
//   displayText?: string; // "You got a SWORD!"
// }

export type Line = NarrativeLine | DecisionLine | JumpLine;

export interface Scene {
  label: string;
  lines: Line[];
}

export interface GameStructure {
  scenes: Scene[];
  startScene: string;
}

// Game state for the player

export interface HistoryEntry {
  lineId: string;
  type: LineType.NARRATIVE | LineType.DECISION | LineType.JUMP;
  text: string;
  chosenOption?: string; // For decisions, what the player typed
  meta?: boolean; // For ancillary/system notes (e.g., selected variant)
  selectionMeta?: { option: string; confidence?: number; cached?: boolean };
}

export interface GameState {
  history: HistoryEntry[];
  isEnded: boolean;
  // Future: inventory: Set<string>, stats: Record<string, number>
}

