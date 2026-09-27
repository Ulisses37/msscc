'use client'


// Translation map between broad Permission categories and its pages
// Too add another page to a category, just append it to the [] array
const permissionsCategories: Record<string, string[]> = {
  Finances: ["Members", "Donations", "Partners"],
  Text_Editing: ["Edit Pages"],
  Board_Members: ["Board Members"],
  Events: ["Events", "Volunteers"],
  Executive: ["Permissions Pages"],
  Help: ["Dashboard", "Documentation Pages", "Help Pages"],
}

// find which category the submitted page belongs to
function getPagePermission(page: string): string | undefined {
  for (const [category, subcategories] of Object.entries(permissionsCategories)){
    if (subcategories.includes(page)){
      return category;
    }
  }
  return undefined;
}

// check if the submitted admin has access to the submitted page category
export function hasPermission(
  {
    adminPermissions,
    permissionNeeded,
  } : {
    adminPermissions?: Record<string, boolean>;
    permissionNeeded: string;
  }): boolean {
    if (!adminPermissions) return false;

    const Permission = getPagePermission(permissionNeeded);
    if(!Permission) return false;

  return !!adminPermissions[Permission];
}

export function fetchLocalStorageAdmin(){
  const current_admin = localStorage.getItem("msscc_user");
  if (!current_admin) return;

  const userData: {
    userId: string;
    email: string;
    firstName: string;
    permissionData: Record<string, boolean>;
  } = JSON.parse(current_admin);

  return userData;
}
