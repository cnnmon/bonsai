export type BranchType = "jump_to_existing" | "jump_to_new";

export interface BranchOptionContinuation {
  text: string;
  paragraphs: string[];
  jumpTarget?: string;
}

export interface BranchScene {
  label: string;
  paragraphs: string[];
  decision?: {
    prompt: string;
    options: BranchOptionContinuation[];
  };
}

export interface BranchGenerationResult {
  type: BranchType;
  optionText?: string;
  paragraphs: string[];
  targetScene?: string;
  newScene?: BranchScene;
}

export interface BranchGenerationResultPayload {
  input: string;
  decisionPrompt: string;
  options: { id: string; texts: string[] }[];
  sceneLabel: string;
  existingScenes: string[];
  history: string[];
  newSceneLabel?: string;
  customPrompt?: string;
  result?: BranchGenerationResult;
}

