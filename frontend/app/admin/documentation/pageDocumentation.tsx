import { getPage } from '../dashboard/pageDisplay';

interface AdminPageInfo{
  pageName: string;
  pageDescription: string;
  pageInstructions: string[]; // an array so you can have multiple lines
}

// Name and Description pulled from frontend\app\admin\dashboard\pageDisplay.tsx for consistency
// Array of pageInstructions allows for easy multi line explanations
export const pageList: AdminPageInfo[] = [
  {
    ...getPage("Partners"),
    pageInstructions: [
      "The Partners page stores a list of Partners, Donors, and Sponsors.",
      "To create a new entry, click the green + in the top right corner of the table.",
      "To edit an existing entry, hover over the entry and click.",
      "When creating or editing a entry in any table, you have the ability to fill in their Name (EN/JP), Website URL, Display Order, Image, and Contribution Amount.",
      "If you enter a Website URL for a partner, the entry on the user-side of the website will become clickable and link to that page.",
      "When editing a partner, you are also given the option to change an image by replacing it with a pre-existing image ID.",
      "If the 'Visible' checkbox is unchecked, the entry will not be displayed on the user-side of the website.",
      "To delete an entry, click to edit it and press the 'Delete' button and press 'ok' on the window pop-up. (This action cannot be undone.)"
    ]
  },
  {
    ...getPage("Board of Directors"),
    pageInstructions: [
      "The Board of Directors page features the MSSCC Officers and Directors.",
      "It's user-side related page is the About|Board page.",
      "The admin-side page allows admins to edit the list of Officers and Directors.",
      "By clicking on an existing Officer, you are able to update their Name (EN/JP), Role (EN/JP), Caption (EN/JP), and their image.",
      "By clicking on an existing Director, you are able to update their Name (EN/JP), change their picturem or delete them from the list.",
      "To create a new Director, click on the Green + button on the top right of the table and input their Name (EN/JP) and image, then press Add.",
      "Any updates made to this page will be reflected on the user-side page."
    ]
  },
  {
    pageName: "Dashboard",
    pageDescription: "Homepage for all admins",
    pageInstructions: [
      "The admin dashboard page is a purely visual page.",
      "It is viewable to all admins and just provides helpful information and diagonistic data about the website",
      "The left sidebar shows the admins Name and Email.",
      "The 'Your Pages' section lists all of the pages that an admin has access to and a quick description of it.",
      "The right sidebar shows analytics about the site.",
      "The first box shows the amount of views that the site has gotten over the course of a month, a year, and its lifetime.",
      "The second box shows the amount of image storage that is currently being used by the website.",
      "Our current tier of storage can only hold up to XXGBs of storage at a time.",
      "The third box shows the Monthly DeepL Translation Usage.",
      "The free tier of DeepL provides 500,000 'Tokens' a month of translation requests.",
      "At the bottom of the page, there are three information carousels: Events, Donations, and Memberships",
      "The Event carousel shows upcoming events and some of the most recent past events. Clicking on an Event will take you to its user-side page.",
      "The Donation and Membership carousels show recent financial contribution Names, Amounts, and Dates.",
      "By clicking on the arrows on the sides of the carousels, they can be scrolled through.",
    ]
  },
  {
    ...getPage("Permissions Pages"),
    pageInstructions: [
      "The admin Permissions Page is where Executive Admins can limit the access that Normal Admins have throughout the site.",
      "The left sidebox shows the Name, and Email of the currently logged in Executive Admin.",
      "The Admin List section contains a list of all Normal Admins and their permissions.",
      "Executive Admin accounts have access to all pages, regardless of their set permissions",
      "Within each Admin entry, there are toggleable permissions that control what that Admin has access too (Colored Buttons).",
      "To learn more about a permission, hovering over it will display a tooltip with a short explanation and its related pages.",
      "Clicking on a permission will flip its toggle state and pressing the Update button at the top of the table will save that information to the database.",
      "Clicking anywhere else within the Admin entry will open a menu for editing the Admins Name and Email.",
      "Within this edit menu, there is also the ability to delete an Admin which removes it from the database. (This action cannot be undone)",
      "To create a new Admin, press the Add button at the top of the table and enter their Name and Email.",
      "Pressing Create will send a 'Forgot Password' email to the provided email where the new Admin can reset their password and then log in after.",
      "When logged in with the pre-determined 'Developer' account, both Executive and Normal Admins will populate the table.",
      "The 'Developer' admin is capable of editing both Executive and Normal admins.",
      "The 'Developer' admin is also given special permission for promoting and demoting Executive Admins.",
      "The 'Developer' admin feature is intended to be used during transfers of leadership and to prevent misuse of the Executive rank.",
    ]
  }
];
