"use client";
export type AdminRecord = {
  name: string;
  email: string;
  executive: boolean;

  // Individual permissions
  // Subject to change
  eventsManipulation: boolean;
  sendEmails: boolean;
  viewMemberRecords: boolean;
  pageEdit: boolean;
  translationEdit: boolean;
};

export const SampleAdminRecordData: AdminRecord[] = [
  {
    name: "Jane Doe",
    email: "JaneDoe@gmail.com",
    executive: true,

    eventsManipulation: true,
    sendEmails: true,
    viewMemberRecords: true,
    pageEdit: true,
    translationEdit: true,
  },
  {
    name: "Alex Nguyen",
    email: "AlexNguyen@gmail.com",
    executive: false,

    eventsManipulation: true,
    sendEmails: false,
    viewMemberRecords: false,
    pageEdit: false,
    translationEdit: false,
  },
  {
    name: "John Smith",
    email: "JohnSmith@gmail.com",
    executive: false,

    eventsManipulation: false,
    sendEmails: true,
    viewMemberRecords: false,
    pageEdit: false,
    translationEdit: false,
  },
];
