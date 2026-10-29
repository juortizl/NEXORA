import { create } from "zustand";

export type ColorMode = "status" | "typology" | "price";
export type CameraMode = "orbit" | "floorView";

type ViewerState = {
  selectedUnitId: string | null;
  hoveredUnitId: string | null;
  compareIds: string[];
  colorMode: ColorMode;
  cameraMode: CameraMode;
  /** Piso de corte: oculta los pisos por encima (null = sin corte) */
  floorCut: number | null;
  /** Hora del día 0..24 para el ciclo solar */
  timeOfDay: number;
  filterTypology: string | null;
  filterStatus: string | null;
  showLabels: boolean;
  autoRotate: boolean;

  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  setColorMode: (m: ColorMode) => void;
  setCameraMode: (m: CameraMode) => void;
  setFloorCut: (f: number | null) => void;
  setTimeOfDay: (t: number) => void;
  setFilterTypology: (t: string | null) => void;
  setFilterStatus: (s: string | null) => void;
  setShowLabels: (v: boolean) => void;
  setAutoRotate: (v: boolean) => void;
};

export const useViewerStore = create<ViewerState>((set) => ({
  selectedUnitId: null,
  hoveredUnitId: null,
  compareIds: [],
  colorMode: "status",
  cameraMode: "orbit",
  floorCut: null,
  timeOfDay: 15,
  filterTypology: null,
  filterStatus: null,
  showLabels: true,
  autoRotate: false,

  select: (id) => set({ selectedUnitId: id }),
  hover: (id) => set({ hoveredUnitId: id }),
  toggleCompare: (id) =>
    set((s) => ({
      compareIds: s.compareIds.includes(id)
        ? s.compareIds.filter((x) => x !== id)
        : s.compareIds.length >= 4
          ? [...s.compareIds.slice(1), id]
          : [...s.compareIds, id],
    })),
  clearCompare: () => set({ compareIds: [] }),
  setColorMode: (colorMode) => set({ colorMode }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setFloorCut: (floorCut) => set({ floorCut }),
  setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
  setFilterTypology: (filterTypology) => set({ filterTypology }),
  setFilterStatus: (filterStatus) => set({ filterStatus }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setAutoRotate: (autoRotate) => set({ autoRotate }),
}));
