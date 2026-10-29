import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { RouterOutputs } from "@/components/project/project-context";
import { computeQuote } from "@/lib/quote-engine";

type Quote = RouterOutputs["quote"]["byId"];

const fmt = (n: number) => "$ " + Math.round(n).toLocaleString("es-CO");
const pct = (n: number) => `${Math.round(n * 1000) / 10} %`;
const date = (d: Date | string | null | undefined) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }) : "—");

export function QuotePdf({ quote }: { quote: Quote }) {
  const p = quote.project;
  const styles = makeStyles(p.primaryColor, p.secondaryColor, p.accentColor);
  const result = computeQuote({
    listPrice: quote.listPrice,
    discount: quote.discount,
    variantsTotal: quote.variantsTotal,
    separation: quote.separation,
    downPaymentPct: quote.downPaymentPct,
    downPaymentMonths: quote.downPaymentMonths,
    subsidy: quote.subsidy,
    annualRate: quote.annualRate,
    loanYears: quote.loanYears,
  });
  const variants: string[] = (() => {
    try {
      return JSON.parse(quote.selectedVariants);
    } catch {
      return [];
    }
  })();

  return (
    <Document title={`Cotización ${quote.unit.code} - ${p.name}`} author={p.company.name}>
      <Page size="LETTER" style={styles.page}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{p.name.toUpperCase()}</Text>
            {p.tagline && <Text style={styles.tagline}>{p.tagline}</Text>}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.headerSmall}>COTIZACIÓN N.º {quote.id.slice(-6).toUpperCase()} · v{quote.version}</Text>
            <Text style={styles.headerSmall}>Fecha: {date(quote.createdAt)}</Text>
            <Text style={styles.headerSmall}>Válida hasta: {date(quote.validUntil)}</Text>
          </View>
        </View>

        {/* Comprador y unidad */}
        <View style={styles.row}>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>CLIENTE</Text>
            {quote.buyer ? (
              <>
                <Text style={styles.strong}>
                  {quote.buyer.firstName} {quote.buyer.lastName}
                </Text>
                <Text style={styles.small}>
                  {quote.buyer.documentType} {quote.buyer.documentNumber ?? ""}
                </Text>
                <Text style={styles.small}>{quote.buyer.phone ?? ""} {quote.buyer.email ? `· ${quote.buyer.email}` : ""}</Text>
              </>
            ) : (
              <Text style={styles.small}>Sin asignar</Text>
            )}
          </View>
          <View style={styles.box}>
            <Text style={styles.boxTitle}>APARTAMENTO</Text>
            <Text style={styles.strong}>
              {quote.unit.code} · Tipo {quote.unit.typology.name}
            </Text>
            <Text style={styles.small}>
              {quote.unit.tower.name} · Piso {quote.unit.floor} · {quote.unit.typology.bedrooms} alcobas · {quote.unit.typology.bathrooms} baños
            </Text>
            <Text style={styles.small}>
              Área privada {quote.unit.typology.privateArea.toFixed(2)} m² · Área construida {quote.unit.typology.builtArea.toFixed(2)} m²
            </Text>
            {quote.unit.viewTag && <Text style={styles.small}>Vista: {quote.unit.viewTag}</Text>}
            {variants.length > 0 && <Text style={styles.small}>Variantes: {variants.join(", ")}</Text>}
          </View>
        </View>

        {/* Precio */}
        <View style={styles.priceBanner}>
          <View>
            <Text style={styles.priceLabel}>PRECIO FINAL</Text>
            <Text style={styles.priceValue}>{fmt(result.finalPrice)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.priceLabel}>PRECIO POR M² PRIVADO</Text>
            <Text style={styles.priceSub}>{fmt(result.finalPrice / quote.unit.typology.privateArea)}</Text>
          </View>
        </View>

        {/* Tabla resumen */}
        <View style={styles.table}>
          <Row styles={styles} label="Precio de lista" value={fmt(result.listPrice)} />
          {result.variantsTotal > 0 && <Row styles={styles} label="Variantes" value={`+ ${fmt(result.variantsTotal)}`} />}
          {result.discount > 0 && <Row styles={styles} label="Descuento comercial" value={`- ${fmt(result.discount)}`} />}
          <Row styles={styles} label="Separación" value={fmt(result.separation)} />
          <Row styles={styles} label={`Cuota inicial (${pct(result.downPaymentPct)})`} value={fmt(result.downPaymentTotal)} />
          <Row styles={styles} label={`${result.downPaymentMonths} cuotas mensuales de`} value={fmt(result.downPaymentMonthly)} strong />
          {result.subsidy > 0 && <Row styles={styles} label="Subsidio aplicado" value={`- ${fmt(result.subsidy)}`} />}
          <Row styles={styles} label="Saldo a financiar" value={fmt(result.loanAmount)} />
          <Row styles={styles} label={`Cuota crédito estimada (${pct(result.annualRate)} E.A. · ${result.loanYears} años)`} value={fmt(result.loanMonthly)} strong />
        </View>

        {/* Plan de pagos resumido */}
        <Text style={styles.sectionTitle}>PLAN DE PAGOS DE LA CUOTA INICIAL</Text>
        <View style={styles.schedule}>
          <View style={[styles.schedRow, styles.schedHead]}>
            <Text style={[styles.schedCell, { width: "15%" }]}>Mes</Text>
            <Text style={[styles.schedCell, { width: "45%" }]}>Concepto</Text>
            <Text style={[styles.schedCell, { width: "20%", textAlign: "right" }]}>Valor</Text>
            <Text style={[styles.schedCell, { width: "20%", textAlign: "right" }]}>Acumulado</Text>
          </View>
          {compactSchedule(result.schedule).map((r, i) => (
            <View key={i} style={styles.schedRow}>
              <Text style={[styles.schedCell, { width: "15%" }]}>{r.month}</Text>
              <Text style={[styles.schedCell, { width: "45%" }]}>{r.concept}</Text>
              <Text style={[styles.schedCell, { width: "20%", textAlign: "right" }]}>{fmt(r.amount)}</Text>
              <Text style={[styles.schedCell, { width: "20%", textAlign: "right" }]}>{fmt(r.accumulated)}</Text>
            </View>
          ))}
        </View>

        {quote.notes && (
          <View style={styles.notes}>
            <Text style={styles.boxTitle}>OBSERVACIONES</Text>
            <Text style={styles.small}>{quote.notes}</Text>
          </View>
        )}

        {/* Pie */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Asesor: {quote.advisor.name} · {quote.advisor.email} · {p.company.name} · {p.company.phone ?? ""} · {p.company.website ?? ""}
          </Text>
          <Text style={styles.footerText}>
            Precios vigentes hasta {date(p.priceValidUntil)}. Entrega estimada {date(p.deliveryDate)}. La cuota del crédito es una simulación de referencia y depende de la
            aprobación de la entidad financiera. Imágenes y áreas sujetas a cambios de diseño y/o aprobaciones.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function Row({ styles, label, value, strong }: { styles: ReturnType<typeof makeStyles>; label: string; value: string; strong?: boolean }) {
  return (
    <View style={[styles.tableRow, strong ? styles.tableRowStrong : {}]}>
      <Text style={styles.tableLabel}>{label}</Text>
      <Text style={[styles.tableValue, strong ? { fontSize: 12 } : {}]}>{value}</Text>
    </View>
  );
}

/** Agrupa cuotas iguales consecutivas para que el plan quepa en una página. */
function compactSchedule(schedule: { month: number; concept: string; amount: number; accumulated: number }[]) {
  const out: { month: string; concept: string; amount: number; accumulated: number }[] = [];
  const label = (c: string) => (c === "SEPARACION" ? "Separación" : c === "CUOTA_INICIAL" ? "Cuota inicial" : "Desembolso crédito + subsidio");
  let i = 0;
  while (i < schedule.length) {
    const r = schedule[i];
    if (r.concept !== "CUOTA_INICIAL") {
      out.push({ month: String(r.month), concept: label(r.concept), amount: r.amount, accumulated: r.accumulated });
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < schedule.length && schedule[j + 1].concept === "CUOTA_INICIAL" && schedule[j + 1].amount === r.amount) j++;
    out.push({
      month: i === j ? String(r.month) : `${r.month} a ${schedule[j].month}`,
      concept: i === j ? "Cuota inicial" : `Cuota inicial (${j - i + 1} cuotas)`,
      amount: r.amount,
      accumulated: schedule[j].accumulated,
    });
    i = j + 1;
  }
  return out;
}

function makeStyles(primary: string, secondary: string, accent: string) {
  return StyleSheet.create({
    page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 2, borderBottomColor: accent, paddingBottom: 10, marginBottom: 14 },
    brand: { fontSize: 22, fontFamily: "Helvetica-Bold", color: primary, letterSpacing: 2 },
    tagline: { fontSize: 9, color: secondary, marginTop: 2 },
    headerSmall: { fontSize: 8, color: "#6b7280", marginBottom: 2 },
    row: { flexDirection: "row", gap: 10, marginBottom: 12 },
    box: { flex: 1, borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8 },
    boxTitle: { fontSize: 7, color: "#6b7280", letterSpacing: 1.5, marginBottom: 4 },
    strong: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
    small: { fontSize: 8.5, color: "#374151", marginBottom: 1.5 },
    priceBanner: { flexDirection: "row", justifyContent: "space-between", backgroundColor: primary, borderRadius: 4, padding: 12, marginBottom: 12 },
    priceLabel: { fontSize: 7, color: "#e5e7eb", letterSpacing: 1.5 },
    priceValue: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#ffffff", marginTop: 2 },
    priceSub: { fontSize: 12, fontFamily: "Helvetica-Bold", color: accent, marginTop: 4 },
    table: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, marginBottom: 14 },
    tableRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
    tableRowStrong: { backgroundColor: "#fbf7ec" },
    tableLabel: { fontSize: 9, color: "#374151" },
    tableValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
    sectionTitle: { fontSize: 8, color: secondary, letterSpacing: 1.5, marginBottom: 6, fontFamily: "Helvetica-Bold" },
    schedule: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, marginBottom: 12 },
    schedRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
    schedHead: { backgroundColor: "#f3f4f6" },
    schedCell: { fontSize: 8.5 },
    notes: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 8, marginBottom: 12 },
    footer: { position: "absolute", bottom: 24, left: 36, right: 36, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 6 },
    footerText: { fontSize: 7, color: "#6b7280", marginBottom: 2, lineHeight: 1.4 },
  });
}
