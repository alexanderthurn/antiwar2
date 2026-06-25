import { publicUrl } from '../core/PublicPath';

export type CollisionVertex = Readonly<{ x: number; y: number }>;
/** Convex polygons in source-image pixel space (PhysicsEditor / Matter export). */
export type CollisionShape = ReadonlyArray<ReadonlyArray<CollisionVertex>>;

interface PhysicsEditorFixture {
  vertices?: CollisionVertex[][];
}

interface PhysicsEditorBody {
  fixtures?: PhysicsEditorFixture[];
}

type PhysicsEditorFile = Record<string, PhysicsEditorBody | string | undefined>;

const shapes = new Map<string, CollisionShape>();

/** Basename without extension, lowercased — matches PhysicsEditor Phaser export keys. */
export function shapeKeyFromImagePath(path: string): string {
  const file = path.replace(/\\/g, '/').split('/').pop() ?? path;
  const dot = file.lastIndexOf('.');
  return (dot >= 0 ? file.slice(0, dot) : file).toLowerCase();
}

export async function loadCollisionShapes(): Promise<boolean> {
  const src = publicUrl('assets/collision/shapes.json');
  try {
    const response = await fetch(src);
    if (!response.ok) return false;
    const data = (await response.json()) as PhysicsEditorFile;
    shapes.clear();

    for (const [key, body] of Object.entries(data)) {
      if (key === 'generator_info' || !body || typeof body === 'string') continue;
      const polys: CollisionVertex[][] = [];
      for (const fixture of body.fixtures ?? []) {
        for (const poly of fixture.vertices ?? []) {
          if (poly.length >= 3) polys.push(poly);
        }
      }
      if (polys.length > 0) shapes.set(key.toLowerCase(), polys);
    }
    return shapes.size > 0;
  } catch {
    return false;
  }
}

export function getCollisionShape(imagePath: string): CollisionShape | undefined {
  return shapes.get(shapeKeyFromImagePath(imagePath));
}
