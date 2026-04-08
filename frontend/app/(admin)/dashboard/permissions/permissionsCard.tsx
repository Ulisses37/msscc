"use client";
import { AdminRecord } from "./sampleData";

interface PermissionCardProps {
  permission: AdminRecord;
}

export default function PermissionCard ({ permission }: PermissionCardProps) {
  return (
    <div className = "border rounded-md p-6">
      <h1>{permission.name}</h1>
      <h1>{permission.email}</h1>
    </div>
  );
}
