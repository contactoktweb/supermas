/**
 * Contraseña inicial que el sistema asigna cuando el administrador no define una.
 * Es temporal: la cuenta queda marcada para cambiarla en el primer ingreso.
 */
export function getDefaultInitialPassword(): string {
  return `SuperMas${new Date().getFullYear()}*`
}
