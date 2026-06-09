import { Controller, Get } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

// Liveness probe for Docker healthchecks. Must be @AllowAnonymous() — the global
// AuthGuard (from @thallesp/nestjs-better-auth) 401s everything otherwise, and the
// container would never report healthy. No I/O on purpose: compose already orders
// `api` after postgres-healthy + migrate-completed, so a DB ping here is redundant.
@Controller("health")
export class HealthController {
  @Get()
  @AllowAnonymous()
  check() {
    return { status: "ok" };
  }
}
