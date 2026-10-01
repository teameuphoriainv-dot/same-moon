import { Capacitor } from "@capacitor/core";
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

/**
 * Same Moon Plus through RevenueCat. Every export is safe on the web and during
 * SSR, where there is no store: they resolve to false or null and do nothing.
 *
 * The plugin is loaded with a dynamic import so the web bundle never touches it
 * until the native app asks.
 */

export const PLUS_ENTITLEMENT = "plus";

export interface PlusOffer {
  title: string;
  priceLabel: string;
  periodLabel: string;
}

type RevenueCat = typeof import("@revenuecat/purchases-capacitor");

/**
 * Holds the module, never the plugin itself. The plugin is a Capacitor proxy
 * that answers every property, `then` included, so resolving a promise with it
 * would try to call a native method named "then".
 */
let ready: Promise<RevenueCat | null> | null = null;
let configuredFor: string | null = null;
let plusPackage: PurchasesPackage | null = null;
let warned = false;

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

async function configure(appUserId: string): Promise<RevenueCat | null> {
  const apiKey = process.env.NEXT_PUBLIC_RC_API_KEY;
  if (!apiKey) {
    if (!warned) {
      warned = true;
      console.warn("Same Moon Plus is off: NEXT_PUBLIC_RC_API_KEY is not set.");
    }
    return null;
  }
  const rc = await import("@revenuecat/purchases-capacitor");
  if (process.env.NODE_ENV !== "production") {
    await rc.Purchases.setLogLevel({ level: rc.LOG_LEVEL.DEBUG });
  }
  await rc.Purchases.configure({ apiKey, appUserID: appUserId });
  configuredFor = appUserId;
  return rc;
}

export async function initPurchases(appUserId: string): Promise<void> {
  if (!isNativeApp() || !appUserId) return;
  if (!ready) {
    ready = configure(appUserId).catch((err) => {
      console.warn("RevenueCat did not start.", err);
      ready = null;
      return null;
    });
  }
  const rc = await ready;
  // Configured once per launch. A different person on the same phone switches
  // the RevenueCat user instead of configuring again.
  if (rc && configuredFor !== appUserId) {
    try {
      await rc.Purchases.logIn({ appUserID: appUserId });
      configuredFor = appUserId;
      plusPackage = null;
    } catch (err) {
      console.warn("RevenueCat could not switch users.", err);
    }
  }
}

/** The plugin module once configured, or null on the web or before init. */
async function store(): Promise<RevenueCat | null> {
  if (!isNativeApp() || !ready) return null;
  return ready;
}

function isActive(info: { entitlements: { active: Record<string, unknown> } }): boolean {
  return Boolean(info.entitlements.active[PLUS_ENTITLEMENT]);
}

/** ISO 8601 periods from the store, such as P1M or P1Y, in plain words. */
function periodWords(iso: string | null): string {
  if (!iso) return "one time";
  const m = /^P(\d+)([DWMY])$/.exec(iso);
  if (!m) return "";
  const n = Number(m[1]);
  const unit = { D: "day", W: "week", M: "month", Y: "year" }[m[2] as "D" | "W" | "M" | "Y"];
  if (n === 1) return `per ${unit}`;
  // P7D is how some stores spell a week.
  if (unit === "day" && n === 7) return "per week";
  return `every ${n} ${unit}s`;
}

async function currentPackage(rc: RevenueCat): Promise<PurchasesPackage | null> {
  if (plusPackage) return plusPackage;
  const offerings = await rc.Purchases.getOfferings();
  plusPackage = offerings.current?.availablePackages[0] ?? null;
  return plusPackage;
}

export async function loadPlusOffer(): Promise<PlusOffer | null> {
  const rc = await store();
  if (!rc) return null;
  try {
    const pkg = await currentPackage(rc);
    if (!pkg) return null;
    return {
      title: pkg.product.title || "Same Moon Plus",
      priceLabel: pkg.product.priceString,
      periodLabel: periodWords(pkg.product.subscriptionPeriod),
    };
  } catch (err) {
    console.warn("Could not load the Plus offer.", err);
    return null;
  }
}

/**
 * True when Plus is active after the purchase. A cancel resolves false; any
 * other failure throws, so the sheet can tell the two apart.
 */
export async function buyPlus(): Promise<boolean> {
  const rc = await store();
  if (!rc) return false;
  const pkg = await currentPackage(rc);
  if (!pkg) throw new Error("No Plus package in the current offering.");
  try {
    const { customerInfo } = await rc.Purchases.purchasePackage({ aPackage: pkg });
    return isActive(customerInfo);
  } catch (err) {
    const e = err as { code?: string; userCancelled?: boolean | null };
    if (e?.userCancelled || e?.code === rc.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return false;
    }
    throw err;
  }
}

export async function restorePlus(): Promise<boolean> {
  const rc = await store();
  if (!rc) return false;
  const { customerInfo } = await rc.Purchases.restorePurchases();
  return isActive(customerInfo);
}

export async function hasPlusEntitlement(): Promise<boolean> {
  const rc = await store();
  if (!rc) return false;
  try {
    const { customerInfo } = await rc.Purchases.getCustomerInfo();
    return isActive(customerInfo);
  } catch {
    return false;
  }
}
