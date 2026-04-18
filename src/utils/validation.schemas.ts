import { z } from 'zod';

// Menu Item Validation
export const ingredientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Ingredient name is required'),
  allergen: z.boolean().default(false),
});

export const menuItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  price: z.number().positive('Price must be greater than 0'),
  category: z.string().min(1, 'Category is required'),
  image: z.string().url().optional().or(z.literal('')),
  estimated_prep_time: z.number().int().nonnegative().optional(),
  ingredients: z.array(ingredientSchema).optional(),
  available: z.boolean().default(true),
});

export type MenuItemFormData = z.infer<typeof menuItemSchema>;

// User Validation
export const userRoleEnum = z.enum(['waiter', 'kitchen', 'manager', 'admin']);

export const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().min(1, 'Name is required').max(255),
  role: userRoleEnum,
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  role: userRoleEnum.optional(),
  is_active: z.boolean().optional(),
});

export type CreateUserFormData = z.infer<typeof createUserSchema>;
export type UpdateUserFormData = z.infer<typeof updateUserSchema>;

// Authentication Validation
export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const twoFactorSchema = z.object({
  totp_code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type TwoFactorFormData = z.infer<typeof twoFactorSchema>;

// Report Filter Validation
export const reportFilterSchema = z.object({
  from_date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date'),
  to_date: z.string().refine((date) => !isNaN(Date.parse(date)), 'Invalid date'),
  group_by: z.enum(['date', 'table', 'waiter', 'dish']),
  waiter_id: z.string().optional(),
  table_id: z.string().optional(),
  dish_id: z.string().optional(),
});

export type ReportFilterFormData = z.infer<typeof reportFilterSchema>;

// Operating Hours Validation
export const operatingHourSchema = z.object({
  day: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  open_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM'),
  close_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time format must be HH:MM'),
  is_closed: z.boolean().default(false),
});

// Table Validation
export const tableSchema = z.object({
  number: z.number().int().positive('Table number must be positive'),
  name: z.string().min(1, 'Table name is required'),
  capacity: z.number().int().positive('Capacity must be positive'),
  is_active: z.boolean().default(true),
});

export const settingsSchema = z.object({
  restaurant_name: z.string().min(1, 'Restaurant name is required').max(255),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  timezone: z.string().min(1, 'Timezone is required'),
  operating_hours: z.array(operatingHourSchema).optional(),
  tables: z.array(tableSchema).optional(),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;
export type TableFormData = z.infer<typeof tableSchema>;
