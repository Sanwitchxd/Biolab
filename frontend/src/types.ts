export type ModulePage = "reception" | "laboratory" | "management";

export type ReceptionAction = "patients" | "appointments" | "payments" | "whatsapp" | "messages";
export type LaboratoryAction = "samples" | "incidents" | "results" | "validation" | "messages";
export type ManagementAction = "users" | "catalog" | "logs" | "cash" | "stats" | "messages";
export type RoleAction = ReceptionAction | LaboratoryAction | ManagementAction;
