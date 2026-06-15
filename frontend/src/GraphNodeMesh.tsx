import { Text } from "@react-three/drei";
import { useMemo } from "react";
import type { NodeRenderer } from "reagraph";
import { Color, DoubleSide } from "three";
import { getNodeSubLabel, formatNodeLabelDisplay, getNodeColor, intensifyNodeColor } from "./reagraphTheme";

/** Layout still uses full `size` for edge endpoints; draw slightly smaller so arrowheads stay visible. */
const VISUAL_SIZE_RATIO = 0.84;

function GraphNodeMesh({
  id,
  color,
  size,
  opacity,
  nameLabel,
  nameFontSize,
  nameActive,
  highlighted,
  typeLabel,
}: {
  id: string;
  color: string;
  size: number;
  opacity: number;
  nameLabel: string;
  nameFontSize: number;
  nameActive: boolean;
  highlighted: boolean;
  typeLabel?: string;
}) {
  const normalizedColor = useMemo(() => new Color(color), [color]);
  const visualSize = size * VISUAL_SIZE_RATIO;
  const nameLineCount = nameLabel.split("\n").length;
  const nameY = -(size + 6);
  const typeY = nameY - nameLineCount * nameFontSize * 1.15 - 3;

  return (
    <group>
      <mesh renderOrder={1} position={[0, 0, 0.5]} userData={{ id, type: "node" }}>
        <sphereGeometry args={[visualSize, 25, 25]} />
        <meshPhongMaterial
          side={DoubleSide}
          transparent={opacity < 1}
          opacity={opacity}
          color={normalizedColor}
          emissive={normalizedColor}
          emissiveIntensity={highlighted ? 1.15 : 0.7}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <Text
        position={[0, nameY, 2]}
        fontSize={nameFontSize}
        color={nameActive ? "#ffffff" : "#e2e8f0"}
        fillOpacity={opacity}
        anchorX="center"
        anchorY="top"
        lineHeight={1.1}
        textAlign="center"
        outlineWidth={0.08}
        outlineColor="#0b1120"
        renderOrder={2}
      >
        {nameLabel}
      </Text>
      {typeLabel ? (
        <Text
          position={[0, typeY, 2]}
          fontSize={0.42}
          color="#94a3b8"
          fillOpacity={opacity}
          anchorX="center"
          anchorY="top"
          outlineWidth={0.04}
          outlineColor="#0b1120"
          renderOrder={2}
        >
          {typeLabel}
        </Text>
      ) : null}
    </group>
  );
}

export const renderGraphNode: NodeRenderer = ({
  id,
  size,
  opacity,
  selected,
  active,
  node,
}) => {
  const rawName =
    typeof node.data?.name === "string" ? node.data.name : (node.label ?? "");
  const { text: nameLabel, fontSize: nameFontSize } =
    formatNodeLabelDisplay(rawName);
  const nodeType = typeof node.data?.type === "string" ? node.data.type : "";
  const typeLabel = selected && nodeType ? getNodeSubLabel(nodeType) : undefined;
  const baseColor = getNodeColor(nodeType);
  const highlighted = selected || active;
  const displayColor = highlighted ? intensifyNodeColor(baseColor) : baseColor;

  return (
    <GraphNodeMesh
      id={id}
      color={displayColor}
      size={size}
      opacity={opacity}
      nameLabel={nameLabel}
      nameFontSize={nameFontSize}
      nameActive={highlighted}
      highlighted={highlighted}
      typeLabel={typeLabel}
    />
  );
};
