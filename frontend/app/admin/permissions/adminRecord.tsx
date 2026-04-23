"use client";

export type PermissionRecord = {
  permissionName: string;
  hasPermission: boolean;
};

export type AdminRecord = {
    admin_user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    is_executive: boolean;
    permissions: Record<string, boolean>;
};
