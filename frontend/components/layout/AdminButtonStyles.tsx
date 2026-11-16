// Line Sections
//--------------
// Size and Spacing
// Shape
// Color
// Hover
// Typography
// Misc


export const primaryButtonClass = `
  w-full px-4 py-4
  rounded-md
  bg-msscc-pink text-msscc-white
  hover:bg-msscc-pink-dark
  focus-visible:ring-2 focus-visible:ring-msscc-pink text-btn
  disabled:cursor-not-allowed disabled:opacity-50
`;

export const secondaryButtonClass = `
  w-full px-4 py-4
  rounded-md border border-msscc-pink
  text-msscc-pink
  hover:bg-msscc-gray-faint
  focus-visible:ring-2 focus-visible:ring-msscc-pink text-btn

`;

export const dangerButtonClass = `
  w-full px-4 py-4
  rounded-md
  bg-msscc-danger text-msscc-white
  hover:bg-msscc-danger-dark
  focus-visible:ring-2 focus-visible:ring-msscc-danger text-btn

`;

export const addButtonClass = `
  px-2 py-1 sm:px-5 sm:py-2
  rounded-sm
  bg-msscc-pink text-white
  hover:bg-msscc-pink-dark
  text-btn text-xs tracking-btn sm:text-btn
  transition-colors
`;
