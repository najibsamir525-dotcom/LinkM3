import { describe, it, expect } from "vitest";
import { AuthGuard } from "../../src/common/guards/auth.guard.js";
import { UnauthorizedException, type ExecutionContext } from "@nestjs/common";

describe("AuthGuard", () => {
  const guard = new AuthGuard();

  function createMockContext(
    headers: Record<string, string | undefined>,
  ): ExecutionContext {
    const req: Record<string, unknown> = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
  }

  it("authenticates via x-user-id header in test/dev environment", () => {
    const ctx = createMockContext({ "x-user-id": "usr_dev_123" });
    const allowed = guard.canActivate(ctx);
    expect(allowed).toBe(true);
    const req = ctx.switchToHttp().getRequest() as { userId?: string };
    expect(req.userId).toBe("usr_dev_123");
  });

  it("authenticates via valid Bearer authorization header", () => {
    const ctx = createMockContext({
      authorization: "Bearer valid_session_token_xyz",
    });
    const allowed = guard.canActivate(ctx);
    expect(allowed).toBe(true);
    const req = ctx.switchToHttp().getRequest() as { userId?: string };
    expect(req.userId).toBe("valid_session_token_xyz");
  });

  it("rejects Bearer header with empty token (covers line 39 token.length === 0)", () => {
    const ctx = createMockContext({ authorization: "Bearer " });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx)).toThrow(
      "Authentication token or session required.",
    );
  });

  it("rejects non-Bearer authorization header (e.g. Basic auth)", () => {
    const ctx = createMockContext({ authorization: "Basic dXNlcjpwYXNz" });
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it("rejects request when no authorization or x-user-id header is present", () => {
    const ctx = createMockContext({});
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});
