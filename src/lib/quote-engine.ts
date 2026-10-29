/**
 * Motor financiero del cotizador. Funciones puras, sin dependencias.
 * Todos los montos en COP, tasas como fracción (0.12 = 12 % E.A.).
 */

export type QuoteInput = {
  listPrice: number;
  /** Descuento en COP (ya calculado) */
  discount?: number;
  /** Suma de variantes seleccionadas (ej. tercera alcoba) */
  variantsTotal?: number;
  separation: number;
  /** Porcentaje de cuota inicial sobre el precio final (0.3 = 30 %) */
  downPaymentPct: number;
  /** Meses para diferir la cuota inicial (restando la separación) */
  downPaymentMonths: number;
  /** Subsidio aplicado al saldo a financiar */
  subsidy?: number;
  /** Tasa efectiva anual del crédito hipotecario */
  annualRate: number;
  loanYears: number;
};

export type QuoteResult = {
  listPrice: number;
  discount: number;
  variantsTotal: number;
  finalPrice: number;
  separation: number;
  downPaymentPct: number;
  downPaymentTotal: number;
  downPaymentRemaining: number;
  downPaymentMonths: number;
  downPaymentMonthly: number;
  subsidy: number;
  loanAmount: number;
  annualRate: number;
  monthlyRate: number;
  loanYears: number;
  loanMonthly: number;
  totalLoanPaid: number;
  totalInterest: number;
  schedule: ScheduleRow[];
};

export type ScheduleRow = {
  month: number;
  concept: "SEPARACION" | "CUOTA_INICIAL" | "DESEMBOLSO";
  amount: number;
  accumulated: number;
};

/** Convierte tasa efectiva anual a tasa efectiva mensual. */
export function annualToMonthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

/** Cuota fija de un crédito (sistema francés). */
export function annuityPayment(principal: number, monthlyRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const f = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * f) / (f - 1);
}

export function computeQuote(input: QuoteInput): QuoteResult {
  const discount = Math.max(0, input.discount ?? 0);
  const variantsTotal = input.variantsTotal ?? 0;
  const subsidy = Math.max(0, input.subsidy ?? 0);

  const finalPrice = Math.max(0, input.listPrice + variantsTotal - discount);
  const downPaymentTotal = Math.round(finalPrice * input.downPaymentPct);
  const separation = Math.min(input.separation, downPaymentTotal);
  const downPaymentRemaining = Math.max(0, downPaymentTotal - separation);
  const months = Math.max(1, input.downPaymentMonths);
  const downPaymentMonthly = Math.round(downPaymentRemaining / months);

  const loanAmount = Math.max(0, finalPrice - downPaymentTotal - subsidy);
  const monthlyRate = annualToMonthlyRate(input.annualRate);
  const loanMonths = input.loanYears * 12;
  const loanMonthly = Math.round(annuityPayment(loanAmount, monthlyRate, loanMonths));
  const totalLoanPaid = loanMonthly * loanMonths;
  const totalInterest = Math.max(0, totalLoanPaid - loanAmount);

  const schedule: ScheduleRow[] = [];
  let acc = separation;
  schedule.push({ month: 0, concept: "SEPARACION", amount: separation, accumulated: acc });
  for (let m = 1; m <= months; m++) {
    // Última cuota ajusta el redondeo
    const amount =
      m === months ? downPaymentRemaining - downPaymentMonthly * (months - 1) : downPaymentMonthly;
    acc += amount;
    schedule.push({ month: m, concept: "CUOTA_INICIAL", amount, accumulated: acc });
  }
  acc += loanAmount + subsidy;
  schedule.push({
    month: months + 1,
    concept: "DESEMBOLSO",
    amount: loanAmount + subsidy,
    accumulated: acc,
  });

  return {
    listPrice: input.listPrice,
    discount,
    variantsTotal,
    finalPrice,
    separation,
    downPaymentPct: input.downPaymentPct,
    downPaymentTotal,
    downPaymentRemaining,
    downPaymentMonths: months,
    downPaymentMonthly,
    subsidy,
    loanAmount,
    annualRate: input.annualRate,
    monthlyRate,
    loanYears: input.loanYears,
    loanMonthly,
    totalLoanPaid,
    totalInterest,
    schedule,
  };
}

/** Ingreso mínimo sugerido (cuota <= 30 % del ingreso familiar). */
export function suggestedMinIncome(loanMonthly: number, ratio = 0.3): number {
  return Math.round(loanMonthly / ratio);
}

/** Precio por m² de área privada. */
export function pricePerM2(price: number, area: number): number {
  return area > 0 ? Math.round(price / area) : 0;
}
