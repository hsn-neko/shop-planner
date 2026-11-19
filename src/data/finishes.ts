// Floor finishes for floor areas, separate from the palettes. "layout" keeps the layout's own floor.
export type FinishGroup = "Hard" | "Wood" | "Soft";
export interface Finish {
  name: string;
  grp: FinishGroup;
  /** main colour, for the 2D plan and the finish picker */
  col: string;
  /** metres one texture repeat covers; 0 stretches the texture over the whole area (rug) */
  tile: number;
}
export const FINISHES: Record<string, Finish> = {
  terrazzo: { name: "Terrazzo", grp: "Hard", col: "#e7e1d7", tile: 2 },
  checker: { name: "Checker tiles", grp: "Hard", col: "#d9d6d0", tile: 2.4 },
  hexagon: { name: "Hexagon tiles", grp: "Hard", col: "#e4ece9", tile: 1.2 },
  concrete: { name: "Polished concrete", grp: "Hard", col: "#b9b6b1", tile: 4 },
  oak: { name: "Light oak", grp: "Wood", col: "#d9bf98", tile: 2.4 },
  walnut: { name: "Dark walnut", grp: "Wood", col: "#6e4c34", tile: 2.4 },
  herringbone: { name: "Herringbone parquet", grp: "Wood", col: "#c79f72", tile: 1.2 },
  carpetgrey: { name: "Grey carpet", grp: "Soft", col: "#8e9196", tile: 2 },
  carpetgreen: { name: "Green carpet", grp: "Soft", col: "#5f7a5e", tile: 2 },
  rug: { name: "Rug-style mat", grp: "Soft", col: "#c98b6b", tile: 0 },
};
export const finishOf = (id: string): Finish | undefined => FINISHES[id];
