[Live game](bonsai-eosin.vercel.app) | [Video demo](https://youtu.be/qMks4tNpRBE)

<img width="1692" height="1161" alt="Screenshot 2025-12-07 at 2 34 50 PM" src="https://github.com/user-attachments/assets/230771f0-2211-480e-9a07-ef7d32805f33" />

An AI game engine inspired by a bonsai tree for interactive branching narratives, where the game grows by itself but allows for easy pruning by the human author. Hacked across 2 days.

<img width="1365" height="1161" alt="Screenshot 2025-12-07 at 2 26 40 PM" src="https://github.com/user-attachments/assets/bb9951fd-21a4-4b84-acce-440b848cc937" />

## Notation

The editor uses a custom notation loosely inspired by Ink:

```
FIRE:
- The fire burns brightly.
* What does the player do?
  ~ Ride a bike
    - That's cool!
    -> BIKE
  ~ Learn to sail
    -> END

BIKE:
- You're biking, that's pretty rad
```

## Architecture

**Editor**: Text editor. Type `/decision`, `/option`, `/goto`, `/narrative` to insert line types. Tab/Shift-Tab for indentation. Enter preserves line type. Parses notation to game structure in real-time.

**Game**: Linear playable interface. At decision points, shows natural language input. If player types something semantically different from existing options, a new branch is generated.

**Interplay**: When the game generates a new branch, the editor updates live. Authors can review/approve/reject changes.
