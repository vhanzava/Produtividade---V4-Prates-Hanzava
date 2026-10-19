import { EmployeeConfig } from '../types';

// Custo de um colaborador num mês.
//
// O custo muda com o tempo (reajuste, promoção) e os dois valores são verdade:
// o que a pessoa recebia até outubro e o que passa a receber a partir de
// novembro. Mudar o custo base reescreveria o passado; um ajuste de mês isolado
// valeria só para aquele mês. Por isso a ordem de precedência abaixo:
//
//   1. ajuste pontual daquele mês (history) — exceção explícita, sempre vence;
//   2. o reajuste mais recente que já começou (costChanges) — "a partir de";
//   3. o custo base (defaultCost) — o que vale antes de qualquer reajuste.

export const getEmployeeMonthCost = (
  emp: EmployeeConfig,
  monthKey: string,
): { cost: number; hours: number } => {
  const pontual = emp.history?.[monthKey];
  if (pontual) return { cost: pontual.cost, hours: pontual.hours };

  const vigente = (emp.costChanges || [])
    .filter(c => c.from && c.from <= monthKey)
    .sort((a, b) => a.from.localeCompare(b.from))
    .pop();

  return { cost: vigente ? vigente.cost : emp.defaultCost, hours: emp.defaultHours };
};
