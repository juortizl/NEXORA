# F0 - Levantamiento de insumos

Documento de arranque del proyecto. Registra lo que ya se extrajo del brochure
`NORTIKO-By-Estructurar.pdf` y lo que la constructora debe entregar para
completar cada fase.

## 1. Información extraída del PDF (proyecto semilla: Nórtiko)

| Dato | Valor |
| --- | --- |
| Nombre comercial | Nórtiko by Estructurar |
| Constructora | Estructurar (www.estructurar.co, 310 281 4975) |
| Ubicación | Bello, Antioquia. Límite con Copacabana. Sobre la Autopista Norte, cerca del Intercambio Vial La Seca |
| Etapa | Lanzamiento Torre 1 |
| Vigencia de precios | 08/26 |
| Torres | 4 torres residenciales (T1 a T4) + torre de amenidades con parqueadero |
| Torre 1 | 26 pisos, 8 apartamentos por piso (208 unidades) |
| Comercio | Mall de conveniencia de 750 m² |
| Urbanismo | Parque lineal, portería, cancha múltiple |

### Tipologías Torre 1 (planta típica)

| Tipología | Letra | Posiciones | Área construida | Área privada | Observaciones |
| --- | --- | --- | --- | --- | --- |
| Ártico | A | 04 | 39,76 m² | 35,80 m² | Solo 1 por piso |
| Polar | B | 01, 08 | 52,08 m² | 46,47 m² | 3 baños y 2 vestieres |
| Bóreo | C | 02, 03, 05, 06, 07 | 53,20 m² | 47,00 m² | Posibilidad de tercera alcoba |

### Amenidades

Zona club house, piscina de adultos, piscina de niños, gimnasio, turco,
coworking, cancha múltiple, zona BBQ, zona de fogatas, juegos infantiles,
zona de mascotas, zona de yoga, zona de lectura, lobby, portería.

### Puntos de interés (minutos de desplazamiento)

Mapa 1 (sector inmediato): Haceb 1 min, Coopidrogas 2 min, I.E. Villanueva 3 min,
Saboripizza, puente peatonal, Centro de Bodegas del Norte 5 min, Smart Fit 6 min,
plaza de mercado 7 min, parque principal 7 min, La Guantería, Cancha Fátima,
Cancha La Pedrera, IMUSA Outlet 8 min, Fiscalía Copacabana 9 min, Parque del
Señor Caído Villanueva.

Mapa 2 (ciudad): Estación Metro Niquía 9 min, Centro Comercial Puerta del Norte
10 min, Estadio Tulio Ospina 10 min, UVA Aguas Claras 9 min, El Mekatiadero 6 min,
Unidad Deportiva Principal de Copacabana 6 min, El Llanerito 9 min, Clínica EMMSA
5 min, Haceb 3 min, Parroquia María Auxilio de los Cristianos.

Hitos futuros: Tren de Cercanías, Intercambio Vial La Seca, conexión
Barbosa-Bello hacia el norte de Antioquia.

### Vistas

Vista al Cerro Quitasol y vista a Copacabana. Hay renders de "vista zona
recreativa" y "vista externa" y una foto del lote.

### Marca

Mensajes de campaña: "Elige cómo quieres empezar", "A veces es independencia.
A veces es construir en pareja. A veces es mirar todo con más claridad."
Pilares: respaldo, compromiso con la calidad, innovación.
Trayectoria: más de 40 años, +15 mil familias, +1.200.000 m² de vivienda,
+800.000 m² de industria, +700.000 m² de urbanismo, +200.000 m² institucional.

## 2. Lo que NO está en el PDF y se modeló con supuestos

Estos valores son placeholders en el seed (`prisma/seed.ts`) y deben
reemplazarse con la información real desde el panel de administración.

| Dato | Supuesto usado | Quién lo entrega |
| --- | --- | --- |
| Precio base por tipología | Ártico 189 M, Polar 246 M, Bóreo 252 M (COP) | Gerencia comercial |
| Incremento por piso | 0,35 % por piso a partir del piso 2 | Gerencia comercial |
| Prima por vista | Quitasol +2 %, Copacabana +1 % | Gerencia comercial |
| Separación | 2.000.000 COP | Gerencia comercial |
| Cuota inicial | 30 % diferida en hasta 36 meses | Gerencia comercial / fiduciaria |
| Tasa de crédito simulada | 12 % E.A. a 20 años | Banco aliado |
| Orientación por posición | 01-04 norte, 05-08 sur | Arquitectura |
| Alturas de piso | 2,6 m libre, 3,0 m planta de amenidades | Arquitectura |
| Fecha de entrega | Diciembre 2028 | Gerencia de proyecto |

## 3. Insumos que debe entregar la constructora

### Para el visor 3D (F2)
- Modelo 3D de la torre y del urbanismo en Revit, SketchUp, FBX o GLB.
- Modelo interior de cada tipología (opcional, mejora el comparador).
- Renders en alta resolución (mínimo 2560 px de lado largo) de fachada,
  amenidades, interiores y vistas.
- Plantas arquitectónicas por tipología en PDF/DWG/SVG.
- Convención de nombres acordada para los nodos del modelo: `T{torre}_P{piso}_U{posición}`
  (ver `docs/pipeline-3d.md`).

### Para precios y cotizador (F3)
- Lista de precios vigente por unidad o por tipología + reglas de incremento.
- Política de separación, cuota inicial, plazos y descuentos.
- Subsidios aplicables (Mi Casa Ya, cajas de compensación) y condiciones.
- Bancos aliados y tasas de referencia para simulación.
- Plantilla actual de cotización (para replicar en el PDF de marca).

### Para inventario y CRM (F4)
- Archivos Excel actuales de inventario y de compradores (se importan con el
  módulo de importación, formato en `docs/importacion-excel.md`).
- Estados del embudo comercial que usan hoy.
- Política de tratamiento de datos (Ley 1581 de 2012) para incluir el
  consentimiento en la ficha del comprador.

### Para presentación y marca (F5)
- Manual de marca: logos en SVG, paleta, tipografías.
- Guion de la presentación comercial actual (PowerPoint) para armar los bloques.

### Operación (F6)
- Lista de asesores y roles para crear usuarios.
- Dominio para el despliegue y cuenta de object storage (R2 o S3).

## 4. Decisiones tomadas en F0

- Nada del proyecto Nórtiko está escrito en código: todo vive en la base de
  datos y se carga mediante el seed. Un proyecto nuevo se crea desde el
  asistente de administración.
- Si un proyecto no tiene modelo 3D cargado, el visor genera la torre de forma
  paramétrica a partir de pisos, posiciones y tipologías. Cuando llegue el
  modelo de la constructora, se sube como GLB y los nodos se enlazan por nombre.
- La base de datos es PostgreSQL en producción (Render). Para desarrollo local
  sin Postgres se usa SQLite con el mismo esquema (`npm run db:local`).
