import { LineType } from "@/types";
import TypeIcon from "./TypeIcon";

type SceneMenuProps = {
  scenes: string[];
  selectedIndex: number;
  onHover: (index: number) => void;
  onSelect: (scene: string) => void;
  leftOffset?: number;
};

export default function SceneMenu({
  scenes,
  selectedIndex,
  onHover,
  onSelect,
  leftOffset = 16,
}: SceneMenuProps) {
  if (scenes.length === 0) return null;
  return (
    <div
      className="absolute top-6 z-[1] bg-white border border-gray-200 shadow-lg text-sm rounded"
      style={{ left: leftOffset }}
    >
      {scenes.map((scene, i) => (
        <div
          key={scene}
          className={`px-3 py-1.5 cursor-pointer flex items-center gap-2 ${
            i === selectedIndex ? "bg-gray-100" : "hover:bg-gray-50"
          }`}
          onMouseEnter={() => onHover(i)}
          onClick={() => onSelect(scene)}
        >
          <TypeIcon type={LineType.SCENE} />
          <span>{scene}</span>
        </div>
      ))}
    </div>
  );
}
