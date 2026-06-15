import { useFrame } from "@react-three/fiber";
import { useEffect } from "react";
import { Mesh, type Object3D } from "three";

const EDGE_RENDER_ORDER = -1000;

function asMesh(object: Object3D): Mesh | null {
  return (object as Mesh).isMesh ? (object as Mesh) : null;
}

function isEdgeMesh(object: Object3D): boolean {
  const mesh = asMesh(object);
  if (!mesh) return false;
  return mesh.userData?.type === "edge" || mesh.geometry?.userData?.type === "edge";
}

function isEdgeGeometry(mesh: Mesh): boolean {
  return mesh.geometry?.userData?.type === "edge" || mesh.userData?.type === "edge";
}

/** Keeps edges behind nodes and disables edge/arrow hover highlighting. */
export default function GraphRenderLayers() {
  useEffect(() => {
    const originalRaycast = Mesh.prototype.raycast;
    Mesh.prototype.raycast = function raycast(raycaster, intersects) {
      if (isEdgeGeometry(this)) return;
      originalRaycast.call(this, raycaster, intersects);
    };
    return () => {
      Mesh.prototype.raycast = originalRaycast;
    };
  }, []);

  useFrame(({ scene }) => {
    scene.traverse((object) => {
      if (isEdgeMesh(object)) {
        object.renderOrder = EDGE_RENDER_ORDER;
      }
    });
  });

  return null;
}
