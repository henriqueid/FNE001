export const normalizeLoginName = (value: string) => value.trim().toLowerCase();

export const loginNameValidationError = (value: string) => {
  const normalized = normalizeLoginName(value);
  if (!/^[a-z][a-z0-9._-]{2,39}$/.test(normalized))
    return "O login deve começar com uma letra e ter de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado.";
  return undefined;
};

export const normalizeCpf = (value: string) => value.replace(/\D/g, "");

export const isValidCpf = (value: string) => {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split("")
      .reduce((total, current, index) => total + Number(current) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
};

export const cpfValidationError = (value: string) => (isValidCpf(value) ? undefined : "Informe um CPF válido.");

export const formatCpf = (value: string) => {
  const cpf = normalizeCpf(value).slice(0, 11);
  return cpf
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
};
