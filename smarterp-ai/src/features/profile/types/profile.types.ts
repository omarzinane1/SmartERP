export interface ProfileIdentity { firstName: string; lastName: string; displayName: string; email: string; phone: string; jobTitle: string }
export interface UserPreferences { language: string; timezone: string; theme: 'system' | 'light' | 'dark'; dateFormat: string; numberFormat: string; notifications: { email: boolean; inApp: boolean; approvals: boolean; invoiceReminders: boolean; stockAlerts: boolean; aiAlerts: boolean } }
export interface PasswordPolicy { minLength: number | null; maxLength: number | null; requireUppercase: boolean; requireNumber: boolean; summary: string }
export interface UserSession { id: string; device: string | null; browser: string | null; ip: string | null; location: string | null; lastActivity: string; createdAt: string; current: boolean; canRevoke: boolean }
export interface ProfileActivity { id: string; event: string; date: string }
export interface UserProfile { id: number; identity: ProfileIdentity; preferences: UserPreferences; role: string; department: string; status: string; avatarUrl: string | null; twoFactorEnabled: boolean; sessions: UserSession[]; activity: ProfileActivity[]; passwordPolicy: PasswordPolicy; capabilities: { canEditProfile: boolean; canEditEmail: boolean; canChangePassword: boolean; canSetup2FA: boolean; canDisable2FA: boolean }; options: { languages: string[]; timezones: string[]; dateFormats: string[]; numberFormats: string[] }; asOf: string }
export type ProfileUpdate = { identity: ProfileIdentity } | { preferences: UserPreferences }
export interface PasswordInput { currentPassword: string; newPassword: string; confirmPassword: string }
export type TwoFactorInput = { action: 'setup' } | { action: 'verify'; setupId: string; code: string } | { action: 'disable' }
export type TwoFactorResult = { status: 'setup'; setupId: string; qrImage: string | null; secret: string | null; codeLength: number | null; instruction: string; simulated: boolean } | { status: 'enabled' | 'disabled'; simulated: boolean }
