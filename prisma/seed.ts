/**
 * Seed del proyecto semilla: Nórtiko by Estructurar.
 * Toda la información proviene del brochure (ver docs/F0-levantamiento.md).
 * Los precios y reglas marcados como "supuesto" son placeholders.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateUnitsForTower, recomputeProjectPrices } from "../src/server/services/inventory";
import { defaultPresentationBlocks } from "../src/server/routers/project";

const db = new PrismaClient();

async function main() {
  console.log("Seed: limpiando datos previos...");
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.leadTask.deleteMany(),
    db.lead.deleteMany(),
    db.quote.deleteMany(),
    db.sale.deleteMany(),
    db.reservation.deleteMany(),
    db.buyerDocument.deleteMany(),
    db.buyer.deleteMany(),
    db.presentation.deleteMany(),
    db.mediaAsset.deleteMany(),
    db.pointOfInterest.deleteMany(),
    db.amenity.deleteMany(),
    db.priceRule.deleteMany(),
    db.unit.deleteMany(),
    db.tower.deleteMany(),
    db.typology.deleteMany(),
    db.project.deleteMany(),
    db.user.deleteMany(),
    db.company.deleteMany(),
  ]);

  const company = await db.company.create({
    data: {
      name: "Estructurar",
      slug: "estructurar",
      website: "https://www.estructurar.co",
      phone: "310 281 4975",
    },
  });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin123*";
  const advisorPassword = process.env.SEED_ADVISOR_PASSWORD ?? "Asesor123*";
  const [admin, gerente, asesor1, asesor2] = await Promise.all([
    db.user.create({
      data: {
        email: (process.env.SEED_ADMIN_EMAIL ?? "admin@estructurar.co").toLowerCase(),
        name: "Administrador",
        role: "ADMIN",
        companyId: company.id,
        passwordHash: await bcrypt.hash(adminPassword, 10),
      },
    }),
    db.user.create({
      data: {
        email: "gerencia@estructurar.co",
        name: "Gerencia Comercial",
        role: "GERENTE_COMERCIAL",
        companyId: company.id,
        passwordHash: await bcrypt.hash(advisorPassword, 10),
      },
    }),
    db.user.create({
      data: {
        email: "asesor1@estructurar.co",
        name: "Laura Gómez",
        role: "ASESOR",
        companyId: company.id,
        passwordHash: await bcrypt.hash(advisorPassword, 10),
      },
    }),
    db.user.create({
      data: {
        email: "asesor2@estructurar.co",
        name: "Andrés Restrepo",
        role: "ASESOR",
        companyId: company.id,
        passwordHash: await bcrypt.hash(advisorPassword, 10),
      },
    }),
  ]);

  console.log("Seed: creando proyecto Nórtiko...");
  const project = await db.project.create({
    data: {
      companyId: company.id,
      slug: "nortiko",
      name: "Nórtiko",
      tagline: "Elige cómo quieres empezar",
      description:
        "A veces es independencia. A veces es construir en pareja. A veces es mirar todo con más claridad. Cada momento pide algo distinto. En Nórtiko, eliges cómo quieres empezar.",
      city: "Bello, Antioquia",
      address: "Autopista Norte, sector Nórtiko, límite con Copacabana",
      latitude: 6.3617,
      longitude: -75.5248,
      stage: "LANZAMIENTO",
      priceValidUntil: new Date("2026-08-31"),
      deliveryDate: new Date("2028-12-15"), // supuesto
      primaryColor: "#0b1f2a",
      secondaryColor: "#14434f",
      accentColor: "#e0b45a",
      separationAmount: 2_000_000, // supuesto
      downPaymentPct: 0.3, // supuesto
      downPaymentMonths: 36, // supuesto
      annualRate: 0.12, // supuesto
      loanYears: 20,
      settings: JSON.stringify({
        campaign: [
          "A veces es independencia.",
          "A veces es construir en pareja.",
          "A veces es mirar todo con más claridad.",
          "Cada momento pide algo distinto.",
        ],
        views: ["Vista al Cerro Quitasol", "Vista a Copacabana"],
        futureMilestones: ["Futuro tren de Cercanías", "Intercambio Vial La Seca", "Conexión Barbosa - Bello"],
        commerce: "Mall de conveniencia de 750 m²",
        urbanism: ["Parque lineal", "Torre de amenidades y parqueadero", "Portería", "Cancha múltiple"],
        companyStats: [
          { label: "Años de experiencia", value: "+40" },
          { label: "Familias", value: "+15 mil" },
          { label: "Vivienda construida", value: "+1.200.000 m²" },
          { label: "Industria", value: "+800.000 m²" },
          { label: "Urbanismo", value: "+700.000 m²" },
          { label: "Institucional", value: "+200.000 m²" },
        ],
        otherProjects: ["Nairobi Apartamentos"],
      }),
      typologies: {
        create: [
          {
            code: "A",
            name: "Ártico",
            description: "Solo 1 por piso. Ideal para empezar con independencia.",
            builtArea: 39.76,
            privateArea: 35.8,
            bedrooms: 1,
            bathrooms: 1,
            basePrice: 189_000_000, // supuesto
            color: "#60a5fa",
            features: JSON.stringify(["Solo 1 por piso", "Cocina abierta", "Balcón"]),
            variants: JSON.stringify([]),
          },
          {
            code: "B",
            name: "Polar",
            description: "3 baños y 2 vestieres. Para construir en pareja.",
            builtArea: 52.08,
            privateArea: 46.47,
            bedrooms: 2,
            bathrooms: 3,
            basePrice: 246_000_000, // supuesto
            color: "#a78bfa",
            features: JSON.stringify(["3 baños", "2 vestieres", "Esquinero", "Doble fachada"]),
            variants: JSON.stringify([]),
          },
          {
            code: "C",
            name: "Bóreo",
            description: "Posibilidad de tercera alcoba. Para mirar todo con más claridad.",
            builtArea: 53.2,
            privateArea: 47.0,
            bedrooms: 2,
            bathrooms: 2,
            basePrice: 252_000_000, // supuesto
            color: "#34d399",
            features: JSON.stringify(["Posibilidad de tercera alcoba", "Estudio", "Balcón"]),
            variants: JSON.stringify([
              { name: "Tercera alcoba", description: "Cerramiento del estudio como alcoba adicional", deltaPrice: 6_500_000 },
            ]),
          },
        ],
      },
      priceRules: {
        create: [
          {
            kind: "FLOOR_INCREMENT",
            label: "Incremento por altura",
            value: 0.0035,
            isPercent: true,
            criteria: JSON.stringify({ fromFloor: 2 }),
            order: 0,
          },
          {
            kind: "VIEW_PREMIUM",
            label: "Vista Cerro Quitasol",
            value: 0.02,
            isPercent: true,
            criteria: JSON.stringify({ viewTag: "QUITASOL" }),
            order: 1,
          },
          {
            kind: "VIEW_PREMIUM",
            label: "Vista Copacabana",
            value: 0.01,
            isPercent: true,
            criteria: JSON.stringify({ viewTag: "COPACABANA" }),
            order: 2,
          },
        ],
      },
      amenities: {
        create: [
          { name: "Club house", zone: "CLUB_HOUSE", icon: "sofa", order: 0 },
          { name: "Piscina adultos", zone: "CLUB_HOUSE", icon: "waves", order: 1 },
          { name: "Piscina niños", zone: "CLUB_HOUSE", icon: "baby", order: 2 },
          { name: "Gimnasio", zone: "CLUB_HOUSE", icon: "dumbbell", order: 3 },
          { name: "Turco", zone: "CLUB_HOUSE", icon: "thermometer", order: 4 },
          { name: "Coworking", zone: "CLUB_HOUSE", icon: "laptop", order: 5 },
          { name: "Cancha múltiple", zone: "URBANISMO", icon: "volleyball", order: 6 },
          { name: "Zona BBQ", zone: "TERRAZA", icon: "flame", order: 7 },
          { name: "Zona de fogatas", zone: "TERRAZA", icon: "flame-kindling", order: 8 },
          { name: "Juegos infantiles", zone: "URBANISMO", icon: "toy-brick", order: 9 },
          { name: "Zona de mascotas", zone: "URBANISMO", icon: "paw-print", order: 10 },
          { name: "Zona de yoga", zone: "TERRAZA", icon: "leaf", order: 11 },
          { name: "Zona de lectura", zone: "CLUB_HOUSE", icon: "book-open", order: 12 },
          { name: "Lobby", zone: "CLUB_HOUSE", icon: "door-open", order: 13 },
          { name: "Portería", zone: "URBANISMO", icon: "shield", order: 14 },
        ],
      },
      pois: {
        create: [
          // Sector inmediato
          { name: "Haceb", category: "COMERCIO", minutes: 1, group: "SECTOR" },
          { name: "Coopidrogas", category: "SALUD", minutes: 2, group: "SECTOR" },
          { name: "I.E. Villanueva", category: "EDUCACION", minutes: 3, group: "SECTOR" },
          { name: "Centro de Bodegas del Norte", category: "COMERCIO", minutes: 5, group: "SECTOR" },
          { name: "Smart Fit", category: "DEPORTE", minutes: 6, group: "SECTOR" },
          { name: "Plaza de mercado", category: "COMERCIO", minutes: 7, group: "SECTOR" },
          { name: "Parque principal Copacabana", category: "RECREACION", minutes: 7, group: "SECTOR" },
          { name: "Cancha Fátima", category: "DEPORTE", minutes: 7, group: "SECTOR" },
          { name: "IMUSA Outlet", category: "COMERCIO", minutes: 8, group: "SECTOR" },
          { name: "Fiscalía Copacabana", category: "OTRO", minutes: 9, group: "SECTOR" },
          // Ciudad
          { name: "Autopista Norte", category: "TRANSPORTE", minutes: 3, group: "CIUDAD" },
          { name: "Clínica EMMSA", category: "SALUD", minutes: 5, group: "CIUDAD" },
          { name: "Unidad Deportiva de Copacabana", category: "DEPORTE", minutes: 6, group: "CIUDAD" },
          { name: "El Mekatiadero", category: "COMERCIO", minutes: 6, group: "CIUDAD" },
          { name: "Estación Metro Niquía", category: "TRANSPORTE", minutes: 9, group: "CIUDAD" },
          { name: "UVA Aguas Claras", category: "RECREACION", minutes: 9, group: "CIUDAD" },
          { name: "El Llanerito", category: "COMERCIO", minutes: 9, group: "CIUDAD" },
          { name: "Centro Comercial Puerta del Norte", category: "COMERCIO", minutes: 10, group: "CIUDAD" },
          { name: "Estadio Tulio Ospina", category: "DEPORTE", minutes: 10, group: "CIUDAD" },
          // Futuro
          { name: "Futuro Tren de Cercanías", category: "TRANSPORTE", minutes: 0, group: "FUTURO" },
          { name: "Intercambio Vial La Seca", category: "TRANSPORTE", minutes: 0, group: "FUTURO" },
        ],
      },
      mediaAssets: {
        create: [
          { kind: "RENDER", title: "Vista externa", url: "/images/nortiko/vista-externa.svg", order: 0 },
          { kind: "RENDER", title: "Vista zona recreativa", url: "/images/nortiko/zona-recreativa.svg", order: 1 },
          { kind: "FOTO", title: "Vista del lote", url: "/images/nortiko/lote.svg", order: 2 },
          { kind: "PDF", title: "Brochure comercial", url: "/docs/NORTIKO-By-Estructurar.pdf", order: 3 },
        ],
      },
    },
    include: { typologies: true },
  });

  // Planta típica Torre 1: 8 apartamentos. Orientación/vista son supuestos.
  const matrix = [
    { position: 1, typologyCode: "B", orientation: "NORTE", viewTag: "QUITASOL" },
    { position: 2, typologyCode: "C", orientation: "NORTE", viewTag: "QUITASOL" },
    { position: 3, typologyCode: "C", orientation: "NORTE", viewTag: "INTERIOR" },
    { position: 4, typologyCode: "A", orientation: "NORTE", viewTag: "INTERIOR" },
    { position: 5, typologyCode: "C", orientation: "SUR", viewTag: "INTERIOR" },
    { position: 6, typologyCode: "C", orientation: "SUR", viewTag: "COPACABANA" },
    { position: 7, typologyCode: "C", orientation: "SUR", viewTag: "COPACABANA" },
    { position: 8, typologyCode: "B", orientation: "SUR", viewTag: "COPACABANA" },
  ];

  const towersSpec = [
    { code: "T1", name: "Torre 1", releaseStatus: "EN_VENTA", positionX: 0, positionZ: 0 },
    { code: "T2", name: "Torre 2", releaseStatus: "PROXIMAMENTE", positionX: 42, positionZ: 0 },
    { code: "T3", name: "Torre 3", releaseStatus: "PROXIMAMENTE", positionX: 0, positionZ: 34 },
    { code: "T4", name: "Torre 4", releaseStatus: "PROXIMAMENTE", positionX: 42, positionZ: 34 },
  ];

  for (const spec of towersSpec) {
    const tower = await db.tower.create({
      data: {
        projectId: project.id,
        code: spec.code,
        name: spec.name,
        floors: 26,
        unitsPerFloor: 8,
        firstResidentialFloor: 1,
        floorHeight: 2.8,
        footprintWidth: 32,
        footprintDepth: 18,
        positionX: spec.positionX,
        positionZ: spec.positionZ,
        modelNodeName: spec.code,
        releaseStatus: spec.releaseStatus,
      },
    });
    // Sólo la Torre 1 (lanzamiento) tiene inventario cargado.
    if (spec.code === "T1") {
      const n = await generateUnitsForTower(db, {
        projectId: project.id,
        towerId: tower.id,
        towerCode: tower.code,
        floors: tower.floors,
        firstResidentialFloor: tower.firstResidentialFloor,
        matrix,
      });
      console.log(`Seed: ${n} unidades generadas en ${tower.code}`);
    }
  }

  const priced = await recomputeProjectPrices(db, project.id);
  console.log(`Seed: ${priced} precios calculados`);

  await db.presentation.create({
    data: {
      projectId: project.id,
      name: "Lanzamiento Torre 1",
      isDefault: true,
      blocks: JSON.stringify(defaultPresentationBlocks("Nórtiko")),
    },
  });

  // Datos comerciales de ejemplo para que el CRM y el dashboard no estén vacíos.
  console.log("Seed: compradores y movimientos de ejemplo...");
  const units = await db.unit.findMany({ where: { projectId: project.id }, orderBy: [{ floor: "asc" }, { position: "asc" }] });
  const byCode = new Map(units.map((u) => [u.code, u]));

  const sampleBuyers = [
    { firstName: "Camila", lastName: "Ortiz", documentNumber: "1017234567", phone: "3001234567", email: "camila.ortiz@example.com", occupation: "Ingeniera", monthlyIncome: 6_500_000, advisor: asesor1, unit: "T1-0702", stage: "SEPARADO", source: "SALA_VENTAS" },
    { firstName: "Julián", lastName: "Mesa", documentNumber: "71345678", phone: "3109876543", email: "julian.mesa@example.com", occupation: "Docente", monthlyIncome: 4_200_000, advisor: asesor2, unit: "T1-1204", stage: "COTIZADO", source: "WEB" },
    { firstName: "Sara", lastName: "Londoño", documentNumber: "1036789012", phone: "3012223344", email: "sara.londono@example.com", occupation: "Diseñadora", monthlyIncome: 5_100_000, advisor: asesor1, unit: "T1-1501", stage: "PROMESA", source: "REFERIDO" },
    { firstName: "Mateo", lastName: "Arango", documentNumber: "1152345678", phone: "3155556677", email: "mateo.arango@example.com", occupation: "Comerciante", monthlyIncome: 7_800_000, advisor: asesor2, unit: "T1-2008", stage: "PROMESA", source: "REDES" },
    { firstName: "Valentina", lastName: "Ríos", documentNumber: "1020456789", phone: "3178889900", email: "valentina.rios@example.com", occupation: "Médica", monthlyIncome: 9_000_000, advisor: asesor1, unit: "T1-0306", stage: "VISITA", source: "FERIA" },
    { firstName: "Daniel", lastName: "Castaño", documentNumber: "98765432", phone: "3201112233", email: "daniel.castano@example.com", occupation: "Contador", monthlyIncome: 5_600_000, advisor: asesor2, unit: undefined, stage: "LEAD", source: "WEB" },
  ] as const;

  for (const b of sampleBuyers) {
    const unit = b.unit ? byCode.get(b.unit) : undefined;
    const buyer = await db.buyer.create({
      data: {
        projectId: project.id,
        firstName: b.firstName,
        lastName: b.lastName,
        documentNumber: b.documentNumber,
        phone: b.phone,
        email: b.email,
        occupation: b.occupation,
        monthlyIncome: b.monthlyIncome,
        consentAccepted: true,
        consentAt: new Date(),
        leads: {
          create: {
            projectId: project.id,
            advisorId: b.advisor.id,
            unitId: unit?.id,
            stage: b.stage,
            source: b.source,
            nextAction: b.stage === "LEAD" ? "Llamar para agendar visita" : b.stage === "VISITA" ? "Enviar cotización" : undefined,
            nextActionAt: new Date(Date.now() + 2 * 86_400_000),
          },
        },
      },
    });

    if (unit && ["COTIZADO", "SEPARADO", "PROMESA"].includes(b.stage)) {
      const listPrice = unit.listPrice;
      const downPaymentTotal = Math.round(listPrice * 0.3);
      await db.quote.create({
        data: {
          projectId: project.id,
          unitId: unit.id,
          buyerId: buyer.id,
          advisorId: b.advisor.id,
          listPrice,
          finalPrice: listPrice,
          separation: 2_000_000,
          downPaymentPct: 0.3,
          downPaymentTotal,
          downPaymentMonths: 36,
          downPaymentMonthly: Math.round((downPaymentTotal - 2_000_000) / 36),
          loanAmount: listPrice - downPaymentTotal,
          annualRate: 0.12,
          loanYears: 20,
          loanMonthly: Math.round(((listPrice - downPaymentTotal) * 0.00949) / (1 - Math.pow(1.00949, -240))),
          validUntil: new Date(Date.now() + 15 * 86_400_000),
        },
      });
    }
    if (unit && (b.stage === "SEPARADO" || b.stage === "PROMESA")) {
      const reservation = await db.reservation.create({
        data: {
          unitId: unit.id,
          buyerId: buyer.id,
          advisorId: b.advisor.id,
          amount: 2_000_000,
          status: b.stage === "PROMESA" ? "CONVERTIDA" : "ACTIVA",
          expiresAt: new Date(Date.now() + 8 * 86_400_000),
        },
      });
      if (b.stage === "PROMESA") {
        await db.sale.create({
          data: { unitId: unit.id, buyerId: buyer.id, advisorId: b.advisor.id, price: unit.listPrice, status: "PROMESA" },
        });
        await db.unit.update({ where: { id: unit.id }, data: { status: "VENDIDO" } });
      } else {
        await db.unit.update({ where: { id: unit.id }, data: { status: "SEPARADO" } });
      }
      void reservation;
    }
  }

  // Unidades bloqueadas (ej. modelo/sala de ventas) para mostrar el estado.
  await db.unit.updateMany({ where: { projectId: project.id, code: { in: ["T1-0101", "T1-0104"] } }, data: { status: "BLOQUEADO", notes: "Apartamento modelo" } });

  await db.auditLog.create({
    data: { userId: admin.id, projectId: project.id, entity: "Project", entityId: project.id, action: "SEED" },
  });

  console.log("Seed completado.");
  console.log(`  Admin:    ${admin.email} / ${adminPassword}`);
  console.log(`  Gerente:  ${gerente.email} / ${advisorPassword}`);
  console.log(`  Asesores: ${asesor1.email}, ${asesor2.email} / ${advisorPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
