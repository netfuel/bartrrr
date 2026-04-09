// Bartrrr service area: Greater Memphis metro zip codes
export const MEMPHIS_ZIP_CODES = new Set([
  // Downtown / Midtown / South Memphis core
  '38103', '38104', '38105', '38106', '38107', '38108', '38109',
  // East Memphis / Orange Mound / Whitehaven
  '38111', '38112', '38113', '38114', '38115', '38116', '38117', '38118', '38119', '38120',
  // Southeast Memphis / Cordova south / Raleigh / Berclair
  '38125', '38126', '38127', '38128',
  // Bartlett / Raleigh area
  '38131', '38132', '38133', '38134', '38135',
  // Germantown
  '38138', '38139',
  // Whitehaven south
  '38141',
  // East (Memphis proper)
  '38157',
  // Cordova / Germantown west
  '38016', '38017', '38018',
  // Collierville area
  '38027',
  // Millington
  '38053',
  // Oakland
  '38060',
])

export function isMemphisZip(zip: string): boolean {
  return MEMPHIS_ZIP_CODES.has(zip.trim())
}
