import { describe, expect, it } from "vitest";
import { annualToMonthlyRate, annuityPayment, computeQuote, pricePerM2, suggestedMinIncome } from "./quote-engine";

describe("quote-engine", () => {
  it("convierte tasa E.A. a mensual", () => {
    expect(annualToMonthlyRate(0.12)).toBeCloseTo(0.009489, 5);
    expect(annualToMonthlyRate(0)).toBe(0);
  });

  it("calcula cuota francesa", () => {
    const monthly = annuityPayment(100_000_000, annualToMonthlyRate(0.12), 240);
    expect(monthly).toBeGreaterThan(1_000_000);
    expect(monthly).toBeLessThan(1_150_000);
    expect(annuityPayment(120, 0, 12)).toBe(10);
    expect(annuityPayment(0, 0.01, 12)).toBe(0);
  });

  it("arma la cotización completa y cuadra el plan de pagos", () => {
    const q = computeQuote({
      listPrice: 252_000_000,
      separation: 2_000_000,
      downPaymentPct: 0.3,
      downPaymentMonths: 36,
      annualRate: 0.12,
      loanYears: 20,
    });
    expect(q.finalPrice).toBe(252_000_000);
    expect(q.downPaymentTotal).toBe(75_600_000);
    expect(q.downPaymentRemaining).toBe(73_600_000);
    expect(q.loanAmount).toBe(176_400_000);
    // El acumulado al final debe ser igual al precio final
    const last = q.schedule[q.schedule.length - 1];
    expect(last.accumulated).toBe(q.finalPrice);
    // Las 36 cuotas suman exactamente el remanente
    const cuotas = q.schedule.filter((r) => r.concept === "CUOTA_INICIAL").reduce((a, r) => a + r.amount, 0);
    expect(cuotas).toBe(q.downPaymentRemaining);
  });

  it("aplica descuento, variantes y subsidio", () => {
    const q = computeQuote({
      listPrice: 200_000_000,
      discount: 5_000_000,
      variantsTotal: 6_500_000,
      subsidy: 30_000_000,
      separation: 2_000_000,
      downPaymentPct: 0.3,
      downPaymentMonths: 24,
      annualRate: 0.12,
      loanYears: 15,
    });
    expect(q.finalPrice).toBe(201_500_000);
    expect(q.loanAmount).toBe(201_500_000 - Math.round(201_500_000 * 0.3) - 30_000_000);
    expect(q.schedule[q.schedule.length - 1].accumulated).toBe(q.finalPrice);
  });

  it("la separación nunca supera la cuota inicial", () => {
    const q = computeQuote({
      listPrice: 10_000_000,
      separation: 5_000_000,
      downPaymentPct: 0.1,
      downPaymentMonths: 12,
      annualRate: 0.1,
      loanYears: 5,
    });
    expect(q.separation).toBe(1_000_000);
    expect(q.downPaymentRemaining).toBe(0);
  });

  it("utilidades", () => {
    expect(pricePerM2(252_000_000, 47)).toBe(5_361_702);
    expect(suggestedMinIncome(1_500_000)).toBe(5_000_000);
  });
});
