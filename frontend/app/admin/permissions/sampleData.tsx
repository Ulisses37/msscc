"use client";

export type PermissionRecord = {
  permissionName: string;
  hasPermission: boolean;
};

export type AdminRecord = {
  name: string;
  email: string;
  executive: boolean;
  permissionsList: PermissionRecord[];
};

const PERMISSION_LABELS = [
  "Events Manipulation",
  "Send Emails",
  "View Member Records",
  "Page Edit",
  "Translation Edit",
];


function makePermissions(values: boolean[]): PermissionRecord[] {
  return PERMISSION_LABELS.map((permissionName, i) => ({ permissionName, hasPermission: values[i] }));
}

export const SampleAdminRecordData: AdminRecord[] = [
  {
    name: "Jane Doe",
    email: "JaneDoe@gmail.com",
    executive: true,
    permissionsList: makePermissions([true,  true,  true,  true,  true ])
  },
  {
    name: "Alex Nguyen",
    email: "AlexNguyen@gmail.com",
    executive: false,
    permissionsList: makePermissions([true,  false, false, false, false])
  },
  {
    name: "John Smith",
    email: "JohnSmith@gmail.com",
    executive: false,
    permissionsList: makePermissions([false, true,  false, false, false])
  },
];
