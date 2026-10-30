import { exerciseById as map, exercises, lessons } from "../../src/content";

export { exercises };
export const lessonBoucles = lessons[0];
export function exerciseById(id: string) {
  const e = map.get(id);
  if (!e) throw new Error(`exercice inconnu : ${id}`);
  return e;
}
