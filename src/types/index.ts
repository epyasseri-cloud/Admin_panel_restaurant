// Menu Item Types
export interface Ingredient {
  id?: string;
  name: string;
  allergen: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  estimated_prep_time?: number;
  ingredients?: Ingredient[];
  available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMenuItemDTO {
  name: string;
  description?: string;
  price: number;
  category: string;
  image?: string;
  estimated_prep_time?: number;
  ingredients?: Ingredient[];
  available?: boolean;
}

// User Types
export type UserRole = 'waiter' | 'kitchen' | 'manager' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  is_active: boolean;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  role: UserRole;
  password?: string;
}

export interface UpdateUserDTO {
  name?: string;
  role?: UserRole;
  is_active?: boolean;
}

// Settings Types
export interface OperatingHour {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface Table {
  id?: string;
  number: number;
  name: string;
  capacity: number;
  is_active: boolean;
}

export interface Settings {
  id: string;
  restaurant_name: string;
  operating_hours: OperatingHour[];
  tables: Table[];
  currency: string;
  timezone: string;
  created_at?: string;
  updated_at?: string;
}

// Report Types
export type ReportGroupBy = 'date' | 'table' | 'waiter' | 'dish';

export interface ReportFilter {
  from_date: string;
  to_date: string;
  group_by: ReportGroupBy;
  waiter_id?: string;
  table_id?: string;
  dish_id?: string;
}

export interface ReportData {
  period: string;
  total_orders: number;
  total_revenue: number;
  items_sold: number;
  details: ReportDetail[];
}

export interface ReportDetail {
  id: string;
  name: string;
  quantity: number;
  total_revenue: number;
  percentage_of_total: number;
}

// Audit Log Types
export type AuditEventType =
  | 'menu_item_created'
  | 'menu_item_updated'
  | 'menu_item_deleted'
  | 'menu_item_availability_changed'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'price_changed'
  | 'bulk_exclusion'
  | 'settings_updated';

export interface AuditLog {
  id: string;
  user_id: string;
  event_type: AuditEventType;
  resource_type: string;
  resource_id: string;
  changes: Record<string, any>;
  reason?: string;
  created_at: string;
}

export interface AuditLogFilter {
  from_date?: string;
  to_date?: string;
  event_type?: AuditEventType;
  user_id?: string;
  resource_type?: string;
}

// 2FA Types
export interface TwoFactorChallenge {
  challenge_id: string;
  action: string;
  created_at: string;
  expires_at: string;
}

export interface TwoFactorVerifyRequest {
  challenge_id: string;
  totp_code: string;
}

export interface TwoFactorVerifyResponse {
  success: boolean;
  message: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Authentication
export interface AuthToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
