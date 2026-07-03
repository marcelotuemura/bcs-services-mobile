import { z } from 'zod';

// Customer schemas
export const customerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  company_name: z.string().max(255).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  mobile: z.string().max(20).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).default('active'),
});

export type CustomerInput = z.infer<typeof customerSchema>;

// Asset schemas
export const assetSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  asset_type: z.enum(['boat', 'engine', 'trailer', 'jet_ski', 'car', 'rv', 'equipment']),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional().nullable(),
  engine: z.string().max(100).optional().nullable(),
  hin: z.string().max(50).optional().nullable(),
  vin: z.string().max(50).optional().nullable(),
  serial_number: z.string().max(100).optional().nullable(),
  registration: z.string().max(100).optional().nullable(),
  color: z.string().max(50).optional().nullable(),
  hours: z.number().int().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  photos: z.array(z.string().url()).optional().nullable(),
  documents: z.array(z.string().url()).optional().nullable(),
});

export type AssetInput = z.infer<typeof assetSchema>;

// Work Order schemas
export const workOrderSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  asset_id: z.string().uuid('Invalid asset ID').optional().nullable(),
  technician_id: z.string().uuid('Invalid technician ID').optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'checked_in', 'in_progress', 'waiting_parts', 'waiting_approval', 'completed', 'delivered', 'cancelled']).default('draft'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().nullable(),
  labor_cost: z.number().min(0).optional().nullable(),
  parts_cost: z.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  customer_notes: z.string().optional().nullable(),
  digital_signature: z.string().optional().nullable(),
});

export type WorkOrderInput = z.infer<typeof workOrderSchema>;

// Work Order Photo schema
export const workOrderPhotoSchema = z.object({
  work_order_id: z.string().uuid('Invalid work order ID'),
  photo_url: z.string().url('Invalid photo URL'),
  description: z.string().optional().nullable(),
});

export type WorkOrderPhotoInput = z.infer<typeof workOrderPhotoSchema>;

// Estimate schemas
export const estimateSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  work_order_id: z.preprocess(
    (val) => (val === "" || val === undefined ? null : val),
    z.string().uuid('Invalid work order ID').nullable().optional()
  ),
  status: z.enum(['draft', 'sent', 'approved', 'rejected', 'expired']).default('draft'),
  labor_total: z.number().min(0).default(0),
  parts_total: z.number().min(0).default(0),
  supplies_total: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
});

export type EstimateInput = z.infer<typeof estimateSchema>;

// Estimate Item schema
export const estimateItemSchema = z.object({
  estimate_id: z.string().uuid('Invalid estimate ID'),
  description: z.string().min(1, 'Description is required').max(255),
  quantity: z.number().min(0.01),
  unit_price: z.number().min(0),
  item_type: z.enum(['labor', 'part', 'supply']),
});

export type EstimateItemInput = z.infer<typeof estimateItemSchema>;

// Invoice schemas
export const invoiceSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  estimate_id: z.string().uuid('Invalid estimate ID').optional().nullable(),
  work_order_id: z.preprocess(
    (val) => (val === "" || val === undefined ? null : val),
    z.string().uuid('Invalid work order ID').nullable().optional()
  ),
  status: z.enum(['draft', 'sent', 'paid', 'partially_paid', 'due', 'overdue', 'cancelled']).default('draft'),
  due_date: z.string().datetime().optional().nullable(),
  subtotal: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  total: z.number().min(0).default(0),
  amount_paid: z.number().min(0).default(0),
  balance_due: z.number().min(0).default(0),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

// Invoice Item schema
export const invoiceItemSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  description: z.string().min(1, 'Description is required').max(255),
  quantity: z.number().min(0.01),
  unit_price: z.number().min(0),
  item_type: z.enum(['labor', 'part', 'supply']),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

// Payment schema
export const paymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  payment_method: z.enum(['cash', 'credit_card', 'ach', 'check', 'stripe']),
  transaction_id: z.string().max(100).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

// Appointment schema
export const appointmentSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  work_order_id: z.preprocess(
    (val) => (val === "" || val === undefined ? null : val),
    z.string().uuid('Invalid work order ID').nullable().optional()
  ),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  description: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine((data) => new Date(data.end_time) > new Date(data.start_time), {
  message: 'End time must be after start time',
  path: ['end_time'],
});

export type AppointmentInput = z.infer<typeof appointmentSchema>;

// File Upload schema
export const fileUploadSchema = z.object({
  entity_type: z.string().min(1, 'Entity type is required'),
  entity_id: z.string().uuid('Invalid entity ID'),
  file_name: z.string().min(1, 'File name is required').max(255),
  file_url: z.string().url('Invalid file URL'),
  file_type: z.string().max(50).optional().nullable(),
  file_size: z.number().int().min(0).optional().nullable(),
});

export type FileUploadInput = z.infer<typeof fileUploadSchema>;

// Note schema
export const noteSchema = z.object({
  entity_type: z.string().min(1, 'Entity type is required'),
  entity_id: z.string().uuid('Invalid entity ID'),
  content: z.string().min(1, 'Content is required'),
  is_internal: z.boolean().default(false),
});

export type NoteInput = z.infer<typeof noteSchema>;

// Team Member schema
export const teamMemberSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['owner', 'general_manager', 'office', 'service_advisor', 'technician', 'accounting', 'invoice_clerk', 'viewer']),
});

export type TeamMemberInput = z.infer<typeof teamMemberSchema>;

// Company Settings schema
export const companySettingsSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  logo: z.string().url('Invalid logo URL').optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  tax_id: z.string().max(50).optional().nullable(),
  currency: z.string().length(3).default('USD'),
  language: z.string().length(2).default('en'),
  timezone: z.string().default('America/New_York'),
});

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
