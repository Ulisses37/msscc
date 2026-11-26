import { getPage } from '../dashboard/pageDisplay';

export type InstructionVariant = 'note' | 'tip' | 'warning';

// A plain string renders as a normal bullet.
// An object lets you style the whole line as a callout (note / tip / warning).
//
// Inline markup supported inside any string:
//   **bold**   *italic*   {pink|text}  {teal|text}  {green|text}  {red|text}  {gray|text}
// (Nesting, such as bold inside a color, is not supported.)
export type Instruction =
  | string
  | { text: string; variant?: InstructionVariant };

export interface AdminPageInfo {
  pageName: string;
  pageDescription: string;
  permissionNeeded: string; // "None", "Executive", Matches permission in permissionData
  pageInstructions: Instruction[]; // an array so you can have multiple lines
}

export function canViewPage(
  page: AdminPageInfo,
  admin: { isExecutive: boolean; permissionData: Record<string, boolean> }
): boolean {
  if (admin.isExecutive) return true;                  // executives see everything
  if (page.permissionNeeded === "None") return true;   // open to all admins
  if (page.permissionNeeded === "Executive") return false;
  return !!admin.permissionData[page.permissionNeeded];
}

// Name and Description pulled from frontend\app\admin\dashboard\pageDisplay.tsx for consistency
// Array of pageInstructions allows for easy multi line explanations
export const adminPageList: AdminPageInfo[] = [
  {
    pageName: "Dashboard",
    pageDescription: "Homepage for all admins",
    permissionNeeded: "None",
    pageInstructions: [

    ],
  },
  {
    ...getPage("Events"),
    permissionNeeded: "Events",
    pageInstructions: [

    ],
  },
  {
    // The help page filters by permission key. Both membership and donation
    // imports require Finances, so keep their instructions in the same entry.
    pageName: "Finances",
    pageDescription: "Membership and donation CSV imports and single-record entry",
    permissionNeeded: "Finances",
    pageInstructions: [

    ],
  },
  {
    ...getPage("Partners"),
    permissionNeeded: "Finances",
    pageInstructions: [

    ],
  },
  {
    ...getPage("Directors"),
    permissionNeeded: "Board_Members",
    pageInstructions: [

    ],
  },
  {
    ...getPage("Edit Pages"),
    permissionNeeded: "Text_Editing",
    pageInstructions: [

    ],
  },
  {
    ...getPage("Media"),
    permissionNeeded: "Media_Management",
    pageInstructions: [

    ],
  },
  {
    ...getPage("Permissions"),
    permissionNeeded: "Executive",
    pageInstructions: [

    ],
  },
];

// User-side (public-facing) pages. Same shape as the admin entries, so the
// same inline markup works: **bold**, *italic*, {teal|text}, {green|text}, etc.
// Unlike the admin list, these pages are not pulled from getPage() because
// they are not admin dashboard pages, so name and description are written here.
export const userPageList: AdminPageInfo[] = [
  {
    pageName: "Home",
    pageDescription: "The landing page visitors see first",
    permissionNeeded: "None",
    pageInstructions: [

    ],
  },
  {
    pageName: "Program|Events",
    pageDescription: "MSSCC programs and upcoming events",
    permissionNeeded: "None",
    pageInstructions: [

    ],
  },
  {
    pageName: "Support",
    pageDescription: "Donation options for supporters",
    permissionNeeded: "None",
    pageInstructions: [

    ],
  },
  {
    pageName: "Membership",
    pageDescription: "Information about becoming a member",
    permissionNeeded: "None",
    pageInstructions: [

    ],
  },
  {
    pageName: "About|Board",
    pageDescription: "MSSCC Officers and Directors",
    permissionNeeded: "None",
    pageInstructions: [

    ],
  },
  {
    pageName: "Partners",
    pageDescription: "Partners, donors, and sponsors",
    permissionNeeded: "None",
    pageInstructions: [

    ],
  },
];
