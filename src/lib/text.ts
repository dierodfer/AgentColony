// Los patrones evitan `\s` pegado a los anclajes de línea: `\s` también casa el
// salto de línea, y ese solapamiento con `^`/`$` es lo que hace retroceder al
// motor de regex de forma superlineal sobre textos largos. `H_SPACE` es espacio
// horizontal (espacio, tabulador…) pero nunca un fin de línea.
const H_SPACE = String.raw`[^\S\r\n]`

const BOLD_OR_CODE = /\*\*|__|`/g
const HEADING = new RegExp(String.raw`^#{1,6}${H_SPACE}+`, 'gm')
const BULLET = new RegExp(String.raw`^${H_SPACE}*[-*]${H_SPACE}+`, 'gm')
const RUN_OF_SPACES = /[ \t]{2,}/g
const BLANK_LINES = /\n{3,}/g

export function cleanText(text: string): string {
  return text
    .replaceAll(BOLD_OR_CODE, '')
    .replaceAll(HEADING, '')
    .replaceAll(BULLET, '• ')
    .replaceAll(RUN_OF_SPACES, ' ')
    .replaceAll(BLANK_LINES, '\n\n')
    .trim()
}
