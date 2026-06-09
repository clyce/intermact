declare module "opentype.js" {
  export interface Path {
    toPathData(decimalPlaces?: number): string;
  }

  export interface Glyph {
    advanceWidth: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }

  export interface Font {
    readonly ascender: number;
    readonly descender: number;
    readonly unitsPerEm: number;
    readonly names: { fontFamily?: { en?: string } };
    charToGlyph(char: string): Glyph;
    getAdvanceWidth(char: string, fontSize: number): number;
  }

  export function parse(buffer: ArrayBuffer): Font;
}
