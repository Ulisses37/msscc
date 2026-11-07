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
  pageInstructions: Instruction[]; // an array so you can have multiple lines
}

// Name and Description pulled from frontend\app\admin\dashboard\pageDisplay.tsx for consistency
// Array of pageInstructions allows for easy multi line explanations
export const adminPageList: AdminPageInfo[] = [
  {
    // The help page filters by permission key; membership record access is
    // controlled by Finances, not a separate Members permission.
    pageName: "Finances",
    pageDescription: "Membership CSV import and single-record entry",
    pageInstructions: [
      "On View Memberships, use Add membership to save a single record. For multiple records, download the membership CSV template and keep its columns in order.",
      "Each CSV row needs first_name, last_name, membership_type and status. Other columns can be left blank when unknown; 0.00 means a known zero, not an unknown amount.",
      "Status: unknown, active, inactive, pending, expired or canceled. Optional payment status: pending, completed, failed, canceled or waived. Optional payment method: cash, check, card, bank_transfer or other. CSV choices ignore capitalization; Paid and Unpaid are not supported aliases.",
      "Dates may use YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY or MM-DD-YYYY. Amounts must be nonnegative decimals with at most two places, without currency symbols or commas.",
      "Upload a UTF-8 CSV of at most 1,048,576 bytes and 500 data rows. Fix row errors in the source file and upload again. Possible duplicates are warnings, not automatic merges.",
      "Preview does not save records. Acknowledge warnings before confirming. Confirm saves the whole batch or none; the result shows the batch and its saved memberships.",
      "If a confirmation response is lost, retry the same reviewed file. After leaving the page, upload and confirm that same file again to retrieve the existing batch without duplicating records.",
    ]
  },
  {
    ...getPage("Partners"),
    pageInstructions: [
      "The **Partners** page stores a list of Partners, Donors, and Sponsors.",
      "To create a new entry, click the {green| +} in the top right corner of the table.",
      "To edit an existing entry, hover over the entry and click.",
      "When creating or editing an entry in any table, you can fill in their **Name (EN/JP)**, **Website URL**, **Display Order**, **Image**, and **Contribution Amount**.",
      "If you enter a **Website URL** for a partner, the entry on the user-side of the website will become clickable and link to that page.",
      "When editing a partner, you can also change an image by replacing it with a pre-existing **image ID**.",
      {
        text: "If the **Visible** checkbox is unchecked, the entry will not be displayed on the user-side of the website.",
        variant: 'tip',
      },
      "To delete an entry, click to edit it, press the {red|Delete} button, and press **OK** on the window pop-up.",
      {
        text: "Deleting an entry **cannot be undone**.",
        variant: 'warning',
      },
    ],
  },
  {
    ...getPage("Directors"),
    pageInstructions: [
      "The **Board of Directors** page features the MSSCC Officers and Directors.",
      "Its user-side related page is the {teal|About|Board} page.",
      "The admin-side page allows admins to edit the list of Officers and Directors.",
      "By clicking on an existing **Officer**, you can update their **Name (EN/JP)**, **Role (EN/JP)**, **Caption (EN/JP)**, and their image.",
      "By clicking on an existing **Director**, you can update their **Name (EN/JP)**, change their picture, or delete them from the list.",
      "To create a new Director, click the {green|green +} button on the top right of the table, input their **Name (EN/JP)** and image, then press **Add**.",
      {
        text: "Any updates made to this page will be reflected on the user-side page.",
        variant: 'note',
      },
    ],
  },
  {
    pageName: "Dashboard",
    pageDescription: "Homepage for all admins",
    pageInstructions: [
      "The admin dashboard page is a **purely visual** page.",
      "It is viewable to all admins and provides helpful information and diagnostic data about the website.",
      "The {pink|left sidebar} shows the admin's **Name** and **Email**.",
      "The **Your Pages** section lists all of the pages that an admin has access to, along with a quick description of each.",
      "The {pink|right sidebar} shows analytics about the site:",
      "The **first box** shows the number of views the site has gotten over the course of a month, a year, and its lifetime.",
      "The **second box** shows the amount of image storage currently being used by the website.",
      {
        text: "Our current storage tier can only hold up to **XX GB** at a time.",
        variant: 'note',
      },
      "The **third box** shows the Monthly **DeepL Translation Usage**.",
      {
        text: "The free tier of DeepL provides **500,000 tokens** a month of translation requests.",
        variant: 'note',
      },
      "At the bottom of the page, there are three information carousels: **Events**, **Donations**, and **Memberships**.",
      "The **Event** carousel shows upcoming events and some of the most recent past events. Clicking on an Event will take you to its user-side page.",
      "The **Donation** and **Membership** carousels show recent financial contribution names, amounts, and dates.",
      {
        text: "Click the arrows on the sides of a carousel to scroll through it.",
        variant: 'tip',
      },
    ],
  },
  {
    ...getPage("Permissions"),
    pageInstructions: [
      "The admin **Permissions** page is where {pink|Executive Admins} can limit the access that {teal|Normal Admins} have throughout the site.",
      "The left sidebox shows the **Name** and **Email** of the currently logged in Executive Admin.",
      "The **Admin List** section contains a list of all Normal Admins and their permissions.",
      {
        text: "Executive Admin accounts have access to **all pages**, regardless of their set permissions.",
        variant: 'note',
      },
      "Within each Admin entry, there are toggleable permissions (the colored buttons) that control what that Admin has access to.",
      {
        text: "Hover over a permission to see a tooltip with a short explanation and its related pages.",
        variant: 'tip',
      },
      "Clicking on a permission will flip its toggle state. Press the **Update** button at the top of the table to save the changes to the database.",
      "Clicking anywhere else within the Admin entry will open a menu for editing the Admin's **Name** and **Email**.",
      "Within this edit menu, you can also delete an Admin, which removes them from the database.",
      {
        text: "Deleting an Admin **cannot be undone**.",
        variant: 'warning',
      },
      "To create a new Admin, press the **Add** button at the top of the table and enter their **Name** and **Email**.",
      "Pressing **Create** will send a 'Forgot Password' email to the provided address, where the new Admin can reset their password and then log in.",
      "When logged in with the pre-determined {red|Developer} account, both Executive and Normal Admins will populate the table.",
      "The {red|Developer} admin can edit both Executive and Normal admins, and has special permission to **promote** and **demote** Executive Admins.",
      {
        text: "The Developer admin feature is intended to be used during **transfers of leadership** and to prevent misuse of the Executive rank.",
        variant: 'note',
      },
    ],
  },
  {
    ...getPage("Edit Pages"),
    pageInstructions: [
      "This page is dedicated to adding and editing **text** and **image** content on the existing public-facing pages. Newly added content is represented as **content blocks** on this page.",
      "The pages affected by this editor are: {teal|Home}, {teal|Program|Events}, {teal|Support}, {teal|Membership}, {teal|About|Board}, and {teal|Partners}.",
      "Both English and Japanese text can be edited through this page. Japanese translations can be generated automatically by clicking the **Translate to Japanese** button.",
      "Choose which page to edit by selecting one under the **SELECT PAGE** dropdown button.",
      "Add new text/image blocks by clicking the {green|+} buttons under **ADD CONTENT**.",
      "Each content block has its own text formatting based on the content type chosen.",
      "To delete a content block, hover over the top right of the block and click the {red|X} button that appears.",
      "To change the order of the displayed content blocks, click the **Move** buttons that appear above each block.",
      {
        text: "The **Preview Page** button shows what the page looks like with your current edits. You do **not** need to save to see the preview.",
        variant: 'tip',
      },
      "The **Save** button saves the currently written content of the entire page.",
      {
        text: "This page only affects content **dynamically added** by this editor. It cannot edit existing static content that is hardcoded in the website itself.",
        variant: 'warning',
      },
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
    pageInstructions: [
      "The **Home** page is the first page most visitors see when they arrive at the MSSCC website.",
      "It introduces MSSCC and points visitors toward the programs, events, donation options, and supporters found on the other pages.",
      {
        text: "Text and image content can be added to this page from the **Edit Pages** admin page.",
        variant: 'tip',
      },
    ],
  },
  {
    pageName: "Program|Events",
    pageDescription: "MSSCC programs and upcoming events",
    pageInstructions: [
      "The **Program|Events** page is where visitors can see MSSCC programs and events.",
      "Each event has its own user-side page. Clicking an event on the admin **Dashboard** carousel will take you there.",
      {
        text: "Additional text and images can be added to this page from the **Edit Pages** admin page.",
        variant: 'tip',
      },
    ],
  },
  {
    pageName: "Support",
    pageDescription: "Donation options for supporters",
    pageInstructions: [
      "The **Support** page is where visitors can find the ways they can donate to MSSCC.",
      "Donations made through the site appear in the **Donations** carousel on the admin Dashboard.",
      {
        text: "Additional text and images can be added to this page from the **Edit Pages** admin page.",
        variant: 'tip',
      },
    ],
  },
  {
    pageName: "Membership",
    pageDescription: "Information about becoming a member",
    pageInstructions: [
      "The **Membership** page is where visitors can learn about joining MSSCC.",
      "New memberships appear in the **Memberships** carousel on the admin Dashboard.",
      {
        text: "Additional text and images can be added to this page from the **Edit Pages** admin page.",
        variant: 'tip',
      },
    ],
  },
  {
    pageName: "About|Board",
    pageDescription: "MSSCC Officers and Directors",
    pageInstructions: [
      "The **About|Board** page shows the MSSCC Officers and Directors.",
      "Its content is managed from the **Board of Directors** admin page, and updates there are reflected here.",
      {
        text: "Additional text and images can be added to this page from the **Edit Pages** admin page.",
        variant: 'tip',
      },
    ],
  },
  {
    pageName: "Partners",
    pageDescription: "Partners, donors, and sponsors",
    pageInstructions: [
      "The **Partners** page displays MSSCC's Partners, Donors, and Sponsors.",
      "Its entries are managed from the **Partners** admin page.",
      "Entries with a **Website URL** are clickable and link to that page.",
      {
        text: "Entries with the **Visible** checkbox unchecked on the admin side will not appear here.",
        variant: 'note',
      },
    ],
  },
];
