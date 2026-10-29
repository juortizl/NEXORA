# Pipeline de modelos 3D

Flujo para llevar los modelos de la constructora (Revit, SketchUp, ArchiCAD)
al visor web. Mientras un proyecto no tenga modelo cargado, el visor genera la
torre de forma paramétrica a partir de pisos, posiciones y tipologías.

## 1. Convención de nombres (obligatoria)

| Elemento | Nombre del nodo | Ejemplo |
| --- | --- | --- |
| Torre (grupo) | `T{código}` | `T1` |
| Apartamento | `T{código}_P{piso 2 dígitos}_U{posición 2 dígitos}` | `T1_P12_U04` |
| Zonas comunes | `AMENITY_{nombre}` | `AMENITY_PISCINA` |
| Comercio | `MALL` | `MALL` |
| Terreno / contexto | `SITE`, `CONTEXT_*` | `CONTEXT_CERRO` |

Cada apartamento debe ser una malla (o grupo) independiente para poder
colorearla y seleccionarla. El código coincide con `Unit.modelNodeName`, que la
plataforma genera automáticamente al crear las unidades.

## 2. Exportación desde la herramienta de diseño

### Revit
1. Instalar el complemento gratuito "glTF Exporter" (o exportar a FBX y pasar
   por Blender).
2. Asegurar que cada apartamento sea una familia/grupo con el nombre de la
   convención. Un script de Dynamo puede renombrar por parámetro `Número`.
3. Exportar sólo los niveles necesarios; excluir mobiliario interior pesado.

### SketchUp
1. Agrupar cada apartamento y asignar el nombre del grupo.
2. Exportar como glTF (Extensión "glTF Export") o como COLLADA e importar en
   Blender.

### Blender (limpieza y cocinado)
1. Importar FBX/DAE/glTF.
2. `Object > Apply > All Transforms`, eliminar duplicados (`Merge by Distance`).
3. Cocinar iluminación (bake) a texturas de 2048 px si se requiere alta calidad.
4. Verificar nombres con el script de la consola:
   ```python
   import bpy, re
   pat = re.compile(r"^T\w+_P\d{2}_U\d{2}$")
   bad = [o.name for o in bpy.data.objects if o.type == "MESH" and not pat.match(o.name) and o.name.startswith("T")]
   print(bad)
   ```
5. Exportar a `.glb` con "Apply Modifiers", "+Y Up", sin cámaras ni luces.

## 3. Optimización

```bash
npm run model:optimize -- modelos/nortiko_raw.glb public/models/nortiko.glb --lod
```

Genera un GLB con geometría comprimida (meshopt), texturas WebP de 2048 px y,
con `--lod`, dos variantes simplificadas (`_lod1`, `_lod2`). Objetivo: menos de
25 MB para el conjunto y menos de 400 k triángulos visibles.

## 4. Validación contra el inventario

```bash
npm run model:validate -- public/models/nortiko.glb nortiko
```

Reporta las unidades de la base de datos que no tienen nodo en el modelo y los
nodos del modelo que no existen en la base de datos. El código de salida es 2
cuando faltan unidades.

## 5. Publicación

1. Subir el GLB al object storage (R2/S3) o a `public/models/` para pruebas.
2. En **Configuración del proyecto > Modelo 3D**, pegar la URL. El visor pasa
   automáticamente del modo paramétrico al modelo real.
3. Si el GLB falla al cargar, el visor vuelve al modo paramétrico sin romperse.

## 6. Interiores por tipología (opcional)

Un GLB por tipología (`Typology.interiorModelUrl`) permite el recorrido
interior en el comparador. Convención de nodos: `ROOM_{nombre}` para resaltar
ambientes.

## 7. Rendimiento en sala de ventas

- Pantallas táctiles: usar `dpr` máximo 1.5 (ya configurado) y el LOD 1.
- Tablets: cargar `_lod2` cuando `navigator.hardwareConcurrency <= 4`.
- Mantener el número de materiales bajo (uno por tipología + fachada).
