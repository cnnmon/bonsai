## Idea

A bonsai game engine for interactive branching narratives, where the game grows by itself but requires pruning.

## Notation

The editor uses a bullet-point notation inspired by Ink:

```
FIRE:
- The fire burns brightly.
* What does the player do?
  ~ Ride a bike
    - That's cool!
    -> BIKE
  ~ Learn to sail
    [+ sailing]
    - END: Sailing end

BIKE:
- You're biking, that's pretty rad
```

Options can require inventory items: `-> Use your sword [? SWORD]` only appears if the player has SWORD. Required options bypass semantic search.

## Architecture

**Editor**: Notion-style text editor with slash commands. Type `/decision`, `/option`, `/goto`, `/narrative` to insert line types. Tab/Shift-Tab for indentation. Enter preserves line type. Parses notation to game structure in real-time.

**Game**: Linear playable interface. At decision points, shows searchable input. If player types something semantically different from existing options, a new branch is generated.

**Interplay**: When the game generates a new branch, the editor updates live. Authors can review/approve/reject changes.

## Roadmap

### Done
- [x] Game type structure (scenes, lines, decisions, jumps)
- [x] `useGame` hook for gameplay state machine
- [x] Searchable decision input with disabled history
- [x] Notation parser (text ↔ structure)
- [x] Notion-style editor with slash commands (`/decision`, `/option`, `/goto`)

### MVP
- [ ] Fuzzy search for option matching (LLM call, embeddings semantic search hopefully)
- [ ] Branch generation when no match found (LLM call -- make this constrained to generate exactly: (1) 1+ paragraph lines (2) a JUMP statement to an existing scene OR generate a new scene (3) the new scene has a new decision point OR an ending)
- [ ] Version control for generated content (diff view, approve/reject)

### Future
- [ ] Variable/inventory system
- [ ] Custom AI narrator prompts
- [ ] Save/load game structures
- [ ] Export to other formats

## Style

Windows 95 aesthetic for inputs/buttons. Barebones demo.
