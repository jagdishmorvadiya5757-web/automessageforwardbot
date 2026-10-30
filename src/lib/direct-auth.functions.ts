import { createServerFn } from "@tanstack/react-start";

export const directAdminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: { email: string; password: string; code?: string }) => data)
  .handler(async ({ data }) => {
    const { buildAdminSession, safeEqual } = await import("./direct-auth.server");

    const secret = process.env["ORACLE_JWT_SECRET"];
    const adminEmail = process.env["DIRECT_ADMIN_EMAIL"];
    const adminPassword = process.env["DIRECT_ADMIN_PASSWORD"];

    if (!secret || !adminEmail || !adminPassword) {
      throw new Error(
        "Direct admin login is not configured yet (missing backend signing key or admin credentials).",
      );
    }

    const emailOk = safeEqual(
      data.email.trim().toLowerCase(),
      adminEmail.trim().toLowerCase(),
    );
    const passwordOk = safeEqual(data.password, adminPassword);
    if (!emailOk || !passwordOk) {
      throw new Error("Invalid email or password.");
    }

    const securityCode = process.env["ADMIN_SECURITY_CODE"];
    if (securityCode && !safeEqual((data.code ?? "").trim(), securityCode.trim())) {
      await new Promise((r) => setTimeout(r, 1500));
      throw new Error("Invalid email, password or security code.");
    }

    return buildAdminSession(adminEmail.trim().toLowerCase(), secret);
  });
