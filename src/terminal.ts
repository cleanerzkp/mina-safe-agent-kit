export function terminalSafe(value: string): string {
  return [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return isUnsafeTextControl(codePoint)
        ? `\\u${codePoint.toString(16).padStart(4, "0")}`
        : character;
    })
    .join("");
}

export function stripUnsafeTextControls(value: string): string {
  return [...value]
    .filter((character) => !isUnsafeTextControl(character.codePointAt(0) ?? 0))
    .join("");
}

function isUnsafeTextControl(codePoint: number): boolean {
  return (
    (codePoint >= 0 && codePoint <= 8) ||
    codePoint === 11 ||
    codePoint === 12 ||
    (codePoint >= 14 && codePoint <= 31) ||
    (codePoint >= 127 && codePoint <= 159) ||
    codePoint === 0x061c ||
    (codePoint >= 0x200b && codePoint <= 0x200f) ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    codePoint === 0x2060 ||
    (codePoint >= 0x2066 && codePoint <= 0x2069) ||
    codePoint === 0xfeff
  );
}
