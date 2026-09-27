'use client'

// Translation map between broad Permission categories and its pages
// Too add another page to a category, just append it to the [] array
const permissionsCategories: Record<string, string[]> = {
  Finances: ["Members", "Donations", "Partners"],
  Text_Editing: ["Edit Pages", "Dashboard"],
  Board_Members: ["Board Members"],
  Events: ["Events", "Volunteers"],
  Executive: ["Permissions Pages"],
  Help: ["Documentation Pages", "Help Pages"],
}

function getPagePermission(page: string): string | undefined {
  for (const [category, subcategories] of Object.entries(permissionsCategories)){
    if (subcategories.includes(page)){
      return category;
    }
  }
  return undefined;
}

export function hasPermission(
  {
    adminPermissions,
    permissionNeeded,
  } : {
    adminPermissions: [string, boolean][];
    permissionNeeded: string;
  }): boolean {
    const Permission = getPagePermission(permissionNeeded);
    if(!Permission) return false;

    const entry = adminPermissions.find(([key]) => key === Permission);
    return entry ? entry[1] : false;
}
