import { z } from 'zod'
import type { PasswordInput, PasswordPolicy, ProfileIdentity, UserPreferences } from '../types/profile.types'
export const profileSchema: z.ZodType<ProfileIdentity, ProfileIdentity> = z.object({ firstName: z.string().trim().max(100), lastName: z.string().trim().max(100), displayName: z.string().trim().min(2, 'Le nom affiché doit contenir au moins 2 caractères.').max(120), email: z.email('Adresse e-mail invalide.'), phone: z.string().max(50), jobTitle: z.string().max(120) })
export const preferenceSchema: z.ZodType<UserPreferences, UserPreferences> = z.object({ language: z.string().min(1), timezone: z.string().min(1), theme: z.enum(['system', 'light', 'dark']), dateFormat: z.string().min(1), numberFormat: z.string().min(1), notifications: z.object({ email: z.boolean(), inApp: z.boolean(), approvals: z.boolean(), invoiceReminders: z.boolean(), stockAlerts: z.boolean(), aiAlerts: z.boolean() }) })
export function passwordSchema(policy: PasswordPolicy): z.ZodType<PasswordInput, PasswordInput> {
  let next = z.string().min(Math.max(1, policy.minLength ?? 1), policy.minLength ? `Au moins ${policy.minLength} caractères selon la politique serveur.` : 'Nouveau mot de passe requis.')
  if (policy.maxLength !== null) next = next.max(policy.maxLength)
  if (policy.requireUppercase) next = next.regex(/[A-Z]/, 'Une majuscule est requise par la politique serveur.')
  if (policy.requireNumber) next = next.regex(/\d/, 'Un chiffre est requis par la politique serveur.')
  return z.object({ currentPassword: z.string().min(1, 'Mot de passe actuel requis.'), newPassword: next, confirmPassword: z.string().min(1, 'Confirmation requise.') }).refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'Les mots de passe ne correspondent pas.' })
}
