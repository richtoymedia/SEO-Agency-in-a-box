import { router } from "../init";
import { brandRouter } from "./brand";
import { jobRouter } from "./job";
import { optimizationRouter } from "./optimization";

export const appRouter = router({
  brand: brandRouter,
  job: jobRouter,
  optimization: optimizationRouter,
});

export type AppRouter = typeof appRouter;
