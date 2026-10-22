/**
 * Lectura obligatoria de variables de entorno para scripts de mantenimiento y pruebas E2E.
 * Las credenciales nunca se escriben en el código: si la variable falta, el script termina.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    console.error(`Falta la variable de entorno ${name}. Defínala en .env.local o en la sesión antes de ejecutar este script.`)
    process.exit(1)
  }
  return value
}
