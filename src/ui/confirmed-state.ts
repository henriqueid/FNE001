/** Confirma a persistência antes de aplicar efeitos de sucesso da interface. */
export type StateCommit<T> = (state: T) => void | boolean | Promise<void | boolean>;
export async function confirmStateCommit(
  commit: () => void | boolean | Promise<void | boolean>,
  confirmed?: () => void,
): Promise<boolean> {
  try {
    if ((await commit()) === false) return false;
    confirmed?.();
    return true;
  } catch {
    return false;
  }
}
