import { z } from 'zod'

export const UserRoleSchema = z.enum([
  'SUPERADMIN',
  'WAREHOUSE_ADMIN',
  'POINT_ADMIN',
  'ACCOUNTANT',
  'SELLER',
  'CASHIER',
])

export const UserStatusSchema = z.enum(['ACTIVE', 'INACTIVE'])

export const CreateUserSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Ingresa un correo electrónico corporativo válido'),
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Solo se permiten letras, números, puntos, guiones'),
  phone: z.string().optional().default(''),
  role: UserRoleSchema,
  locationIds: z.array(z.string()).min(1, 'Debes asignar al menos una bodega o punto'),
  status: UserStatusSchema.default('ACTIVE'),
})

export const UpdateUserSchema = CreateUserSchema.partial()

export const UserFilterSchema = z.object({
  role: z.string().optional(),
  locationId: z.string().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).optional(),
  searchQuery: z.string().optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
