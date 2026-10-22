import { z } from 'zod'
import { newPasswordSchema } from '@/features/auth/schemas/password-policy.schema'

export const UserRoleSchema = z.enum([
  // 7 Roles Definitivos del ERP
  'ADMIN',
  'JEFE_INGRESOS_SALIDAS',
  'FACTURACION_POS',
  'ENCARGADA_VENTA',
  'VENDEDORES',
  'JEFE_BODEGA',
  'RECURSOS_HUMANOS',
  // Roles Legacy
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
  /** Opcional: si se omite, el servidor genera una contraseña temporal aleatoria. */
  password: newPasswordSchema.optional(),
  role: UserRoleSchema,
  locationIds: z.array(z.string()).min(1, 'Debes asignar al menos una bodega o punto'),
  assignedCashRegisterId: z.string().uuid().optional().nullable(),
  status: UserStatusSchema.default('ACTIVE'),
})

/**
 * Edición parcial. Sin valores por defecto: en Zod 4 un `.default()` dentro de `.partial()` se
 * aplicaría y, por ejemplo, reactivaría (status = ACTIVE) a un usuario en cualquier edición.
 */
export const UpdateUserSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres').optional(),
  email: z.string().email('Ingresa un correo electrónico corporativo válido').optional(),
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Solo se permiten letras, números, puntos, guiones')
    .optional(),
  phone: z.string().optional(),
  password: newPasswordSchema.optional(),
  role: UserRoleSchema.optional(),
  locationIds: z.array(z.string()).min(1, 'Debes asignar al menos una bodega o punto').optional(),
  assignedCashRegisterId: z.string().uuid().optional().nullable(),
  status: UserStatusSchema.optional(),
})

/** Cuerpo de PATCH /api/users. La contraseña y el usuario no se editan por esta vía. */
export const UpdateUserRequestSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Usuario inválido'),
  updates: UpdateUserSchema.omit({ password: true, username: true }),
})

export const UserFilterSchema = z.object({
  role: z.string().optional(),
  locationId: z.string().optional(),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).optional(),
  searchQuery: z.string().optional(),
})

export type CreateUserInput = z.infer<typeof CreateUserSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
