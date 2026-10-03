'use client'

type CategoryData = {
  pages: string[];
  tooltip: string;
}

// Translation map between broad Permission categories and its pages
// Too add another page to a category, just append it to the pages[] array
const permissionCategories: Record<string, CategoryData> = {
  Finances: {
    pages: ["Members", "Donations", "Partners"],
    tooltip: "Allows for managing the financial pages: \nMembers, Donations, Partners"
  },
  Text_Editing: {
    pages: ["Edit Pages"],
    tooltip: "Allows editing of common page text, translation, and images:\nEdit Pages"
  },
  Board_Members: {
    pages:  ["Board Members", "Board of Directors"],
    tooltip: "Allows managing of board members names, images, and descriptions:\nBoard of Directors"
  },
  Events: {
    pages: ["Events", "Volunteers"],
    tooltip: "Allows creation and editing of Events and Volunteers:\nEvents"
  },
  Executive: {
    pages: ["Permissions Pages"],
    tooltip: "Allows for editing of admin information and permission:\nPermissions Pages"
  },
}

// find which category the submitted page belongs to
function getPagePermission(page: string): string | undefined {
  for (const [category, data] of Object.entries(permissionCategories)){
    if (data.pages.includes(page)){
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
    isExecutive,
  } : {
    adminPermissions?: Record<string, boolean>;
    permissionNeeded: string;
    isExecutive: boolean;
  }): boolean {
    if (isExecutive) return true;
    if (!adminPermissions) return false;

    const Permission = getPagePermission(permissionNeeded);
    if(!Permission) return true;

  return !!adminPermissions[Permission];
}

export function fetchLocalStorageAdmin(){
  if (typeof window === 'undefined') return undefined;
  const current_admin = localStorage.getItem("msscc_user");
  if (!current_admin) return;

  const userData: {
    userId: string;
    email: string;
    firstName: string;
    permissionData: Record<string, boolean>;
    isExecutive: boolean;
  } = JSON.parse(current_admin);

  return userData;
}

export function getToolTip(category: string): string | undefined {
  return permissionCategories[category]?.tooltip;
}
