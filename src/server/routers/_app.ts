import { createCallerFactory, router } from "../trpc";
import { projectRouter } from "./project";
import { unitRouter } from "./unit";
import { quoteRouter } from "./quote";
import { crmRouter } from "./crm";
import { reservationRouter } from "./reservation";
import { dashboardRouter } from "./dashboard";
import { adminRouter } from "./admin";

export const appRouter = router({
  project: projectRouter,
  unit: unitRouter,
  quote: quoteRouter,
  crm: crmRouter,
  reservation: reservationRouter,
  dashboard: dashboardRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
