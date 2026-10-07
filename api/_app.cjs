var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/server/app.ts
var app_exports = {};
__export(app_exports, {
  app: () => app,
  default: () => app_default,
  recordSaleCompletion: () => recordSaleCompletion
});
module.exports = __toCommonJS(app_exports);
var import_express = __toESM(require("express"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_redis = require("@upstash/redis");
var import_ratelimit = require("@upstash/ratelimit");

// src/lib/firebase-admin.ts
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
var import_storage = require("firebase-admin/storage");
var adminApp = null;
var adminDbInstance = null;
var adminStorageInstance = null;
var adminAuthInstance = null;
function getServiceAccountCredentials() {
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!saEnv) return null;
  if (typeof saEnv === "object") {
    return saEnv;
  }
  if (typeof saEnv === "string") {
    const trimmed = saEnv.trim();
    if (trimmed.startsWith("{")) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        console.error("[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", e.message);
      }
    }
    try {
      const decoded = Buffer.from(trimmed, "base64").toString("utf8");
      if (decoded.trim().startsWith("{")) {
        return JSON.parse(decoded);
      }
    } catch (e) {
    }
  }
  return null;
}
function getAdminApp() {
  if (adminApp) return adminApp;
  const existingApps = (0, import_app.getApps)();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }
  const defaultBucket = process.env.FIREBASE_STORAGE_BUCKET || "drazbesi.firebasestorage.app";
  const credentials = getServiceAccountCredentials();
  try {
    if (credentials) {
      adminApp = (0, import_app.initializeApp)({
        credential: (0, import_app.cert)(credentials),
        storageBucket: defaultBucket,
        projectId: credentials.project_id || "drazbesi"
      });
      console.log("[Firebase Admin] Initialized with service account for project:", credentials.project_id || "drazbesi");
    } else {
      adminApp = (0, import_app.initializeApp)({
        credential: (0, import_app.applicationDefault)(),
        storageBucket: defaultBucket,
        projectId: process.env.FIREBASE_PROJECT_ID || "drazbesi"
      });
      console.log("[Firebase Admin] Initialized with application default credentials");
    }
  } catch (error) {
    console.error("[Firebase Admin] Initialization error:", error.message);
    if (!(0, import_app.getApps)().length) {
      adminApp = (0, import_app.initializeApp)({
        storageBucket: defaultBucket,
        projectId: "drazbesi"
      });
    } else {
      adminApp = (0, import_app.getApps)()[0];
    }
  }
  return adminApp;
}
function getAdminDb() {
  if (adminDbInstance) return adminDbInstance;
  const app2 = getAdminApp();
  adminDbInstance = (0, import_firestore.getFirestore)(app2);
  return adminDbInstance;
}
function getAdminStorage() {
  if (adminStorageInstance) return adminStorageInstance;
  const app2 = getAdminApp();
  adminStorageInstance = (0, import_storage.getStorage)(app2);
  return adminStorageInstance;
}
function getAdminAuth() {
  if (adminAuthInstance) return adminAuthInstance;
  const app2 = getAdminApp();
  const { getAuth: getFirebaseAuth } = require("firebase-admin/auth");
  adminAuthInstance = getFirebaseAuth(app2);
  return adminAuthInstance;
}
var adminDb = new Proxy({}, {
  get(_target, prop) {
    const firestore = getAdminDb();
    const val = firestore[prop];
    if (typeof val === "function") {
      return val.bind(firestore);
    }
    return val;
  }
});
var adminStorage = new Proxy({}, {
  get(_target, prop) {
    const storage = getAdminStorage();
    const val = storage[prop];
    if (typeof val === "function") {
      return val.bind(storage);
    }
    return val;
  }
});
var adminAuth = new Proxy({}, {
  get(_target, prop) {
    const auth = getAdminAuth();
    const val = auth[prop];
    if (typeof val === "function") {
      return val.bind(auth);
    }
    return val;
  }
});
async function uploadBufferToStorage(buffer, destinationPath, contentType = "application/pdf") {
  try {
    const storage = getAdminStorage();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "drazbesi.firebasestorage.app";
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(destinationPath);
    await file.save(buffer, {
      metadata: {
        contentType
      },
      resumable: false
    });
    return destinationPath;
  } catch (error) {
    console.error(`[Firebase Admin Storage] Upload error for ${destinationPath}:`, error.message);
    throw error;
  }
}
function isDocSnapshotExists(snap) {
  if (!snap) return false;
  if (typeof snap.exists === "function") return snap.exists();
  return Boolean(snap.exists);
}
function getDocSnapshotData(snap) {
  if (!snap) return null;
  if (typeof snap.data === "function") return snap.data();
  return snap.data || null;
}

// src/server/walletService.ts
function ensureWalletMigrated(t, userRef, userData) {
  if (userData.available_cents === void 0) {
    const legacyBalance = Number(userData.wallet_balance) || 0;
    const legacyCents = Math.round(legacyBalance * 100);
    t.update(userRef, {
      available_cents: legacyCents,
      held_cents: 0,
      reserved_cents: 0
    });
    if (legacyCents !== 0) {
      const txRef = adminDb.collection("wallet_transactions").doc();
      t.set(txRef, {
        transaction_id: txRef.id,
        user_id: userRef.id,
        type: "migration",
        amount_cents: legacyCents,
        status: "completed",
        idempotency_key: `migration_${userRef.id}`,
        created_at: import_firestore.FieldValue.serverTimestamp()
      });
    }
    return {
      available_cents: legacyCents,
      held_cents: 0,
      reserved_cents: 0
    };
  }
  return {
    available_cents: userData.available_cents || 0,
    held_cents: userData.held_cents || 0,
    reserved_cents: userData.reserved_cents || 0
  };
}
async function reserveWalletFunds(userId, amountCents, type, idempotencyKey, meta) {
  if (amountCents <= 0) throw new Error("Amount must be positive");
  return await adminDb.runTransaction(async (t) => {
    const existingQuery = await t.get(
      adminDb.collection("wallet_transactions").where("idempotency_key", "==", idempotencyKey).limit(1)
    );
    if (!existingQuery.empty) {
      throw new Error("Idempotency key already exists");
    }
    const userRef = adminDb.collection("users").doc(userId);
    const userDoc = await t.get(userRef);
    if (!userDoc.exists) throw new Error("User not found");
    const userData = userDoc.data() || {};
    const wallet = ensureWalletMigrated(t, userRef, userData);
    if (wallet.available_cents < amountCents) {
      throw new Error("Insufficient available balance");
    }
    const newAvailable = wallet.available_cents - amountCents;
    t.update(userRef, {
      available_cents: import_firestore.FieldValue.increment(-amountCents),
      reserved_cents: import_firestore.FieldValue.increment(amountCents),
      wallet_balance: Math.max(0, newAvailable / 100)
    });
    const txRef = adminDb.collection("wallet_transactions").doc();
    const entry = {
      transaction_id: txRef.id,
      user_id: userId,
      type,
      amount_cents: amountCents,
      status: "pending",
      idempotency_key: idempotencyKey,
      created_at: import_firestore.FieldValue.serverTimestamp(),
      ...meta
    };
    t.set(txRef, entry);
    return txRef.id;
  });
}
async function commitReservedFunds(txId, metaUpdates) {
  await adminDb.runTransaction(async (t) => {
    const txRef = adminDb.collection("wallet_transactions").doc(txId);
    const txDoc = await t.get(txRef);
    if (!txDoc.exists) throw new Error("Transaction not found");
    const tx = txDoc.data();
    if (tx.status !== "pending") throw new Error("Transaction is not pending");
    const userRef = adminDb.collection("users").doc(tx.user_id);
    t.update(userRef, {
      reserved_cents: import_firestore.FieldValue.increment(-tx.amount_cents)
    });
    t.update(txRef, {
      status: "completed",
      ...metaUpdates
    });
  });
}
async function rollbackReservedFunds(txId) {
  await adminDb.runTransaction(async (t) => {
    const txRef = adminDb.collection("wallet_transactions").doc(txId);
    const txDoc = await t.get(txRef);
    if (!txDoc.exists) throw new Error("Transaction not found");
    const tx = txDoc.data();
    if (tx.status !== "pending") throw new Error("Transaction is not pending");
    const userRef = adminDb.collection("users").doc(tx.user_id);
    const userDoc = await t.get(userRef);
    const userData = userDoc.data() || {};
    const wallet = ensureWalletMigrated(t, userRef, userData);
    const restoredAvailable = wallet.available_cents + tx.amount_cents;
    t.update(userRef, {
      reserved_cents: import_firestore.FieldValue.increment(-tx.amount_cents),
      available_cents: import_firestore.FieldValue.increment(tx.amount_cents),
      wallet_balance: Math.max(0, restoredAvailable / 100)
    });
    t.update(txRef, {
      status: "failed"
    });
  });
}
async function getUserWallet(userId) {
  return await adminDb.runTransaction(async (t) => {
    const userRef = adminDb.collection("users").doc(userId);
    const userDoc = await t.get(userRef);
    if (!userDoc.exists) throw new Error("User not found");
    const userData = userDoc.data() || {};
    return ensureWalletMigrated(t, userRef, userData);
  });
}
async function creditWalletDepositFromStripe(userId, amountCents, stripePaymentIntentId, meta) {
  if (amountCents <= 0) {
    throw new Error("Deposit amount must be positive integer in cents");
  }
  if (!stripePaymentIntentId) {
    throw new Error("Stripe PaymentIntent ID is required for deposit credit");
  }
  const idempotencyKey = meta?.idempotencyKey || `stripe_deposit_${stripePaymentIntentId}`;
  return await adminDb.runTransaction(async (t) => {
    const existingByIdempotency = await t.get(
      adminDb.collection("wallet_transactions").where("idempotency_key", "==", idempotencyKey).limit(1)
    );
    if (!existingByIdempotency.empty) {
      const existingDoc = existingByIdempotency.docs[0];
      const data = existingDoc.data() || {};
      const userRef2 = adminDb.collection("users").doc(userId);
      const userDoc2 = await t.get(userRef2);
      const userData2 = userDoc2.data() || {};
      const wallet2 = ensureWalletMigrated(t, userRef2, userData2);
      return {
        transaction_id: existingDoc.id,
        amount_cents: data.amount_cents || amountCents,
        available_cents: wallet2.available_cents,
        wallet_balance: Math.max(0, wallet2.available_cents / 100),
        already_processed: true
      };
    }
    const existingByPi = await t.get(
      adminDb.collection("wallet_transactions").where("stripe_payment_intent_id", "==", stripePaymentIntentId).where("type", "==", "deposit").limit(1)
    );
    if (!existingByPi.empty) {
      const existingDoc = existingByPi.docs[0];
      const data = existingDoc.data() || {};
      const userRef2 = adminDb.collection("users").doc(userId);
      const userDoc2 = await t.get(userRef2);
      const userData2 = userDoc2.data() || {};
      const wallet2 = ensureWalletMigrated(t, userRef2, userData2);
      return {
        transaction_id: existingDoc.id,
        amount_cents: data.amount_cents || amountCents,
        available_cents: wallet2.available_cents,
        wallet_balance: Math.max(0, wallet2.available_cents / 100),
        already_processed: true
      };
    }
    const userRef = adminDb.collection("users").doc(userId);
    const userDoc = await t.get(userRef);
    if (!userDoc.exists) {
      throw new Error("Uporabnik ne obstaja v bazi");
    }
    const userData = userDoc.data() || {};
    const wallet = ensureWalletMigrated(t, userRef, userData);
    const newAvailableCents = wallet.available_cents + amountCents;
    const newLegacyBalance = Math.max(0, newAvailableCents / 100);
    t.update(userRef, {
      available_cents: import_firestore.FieldValue.increment(amountCents),
      wallet_balance: newLegacyBalance
    });
    const txRef = adminDb.collection("wallet_transactions").doc();
    const entry = {
      transaction_id: txRef.id,
      user_id: userId,
      type: "deposit",
      amount_cents: amountCents,
      amount: amountCents / 100,
      status: "completed",
      stripe_payment_intent_id: stripePaymentIntentId,
      description: meta?.description || "Platform test balance funding",
      idempotency_key: idempotencyKey,
      created_at: import_firestore.FieldValue.serverTimestamp(),
      environment: meta?.environment || "test",
      ...meta
    };
    t.set(txRef, entry);
    return {
      transaction_id: txRef.id,
      amount_cents: amountCents,
      available_cents: newAvailableCents,
      wallet_balance: newLegacyBalance,
      already_processed: false
    };
  });
}

// src/server/moneyUtils.ts
function parseAmountToCents(val) {
  if (val === void 0 || val === null) return 0;
  let parsed = 0;
  if (typeof val === "number") {
    parsed = val;
  } else if (typeof val === "string") {
    let cleaned = val.trim().replace(/,/g, ".");
    parsed = Number(cleaned);
  }
  if (isNaN(parsed) || !isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.round(parsed * 100);
}

// src/server/escrowConfig.ts
var SHIP_DEADLINE_DAYS = 7;
var AUTO_RELEASE_AFTER_SHIPPED_DAYS = 7;
var AUTO_RELEASE_AFTER_SHIPPED_DAYS_CROSS_BORDER = 14;
var AUTO_COMPLETE_AFTER_DELIVERED_DAYS = 2;
var PICKUP_AUTO_RELEASE_DAYS = 7;
var PRE_RELEASE_BUYER_REMINDER_HOURS = 48;
var PAYOUT_MAX_ATTEMPTS = 5;
var HOLD_ALERT_DAYS = 60;
var HOLD_HARD_LIMIT_DAYS = 75;

// src/lib/feeCalculator.ts
var EU_COUNTRIES = /* @__PURE__ */ new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE"
]);
function getEffectiveTier(userData, nowMs = Date.now()) {
  if (!userData) return "FREE";
  const raw = userData.subscription_tier || userData.subscription;
  if (!raw) return "FREE";
  const upper = String(raw).toUpperCase();
  let tier = upper === "PRO" || upper === "BASIC" ? upper : "FREE";
  const subValidUntil = userData.subscription_valid_until;
  const isCanceled = userData.subscription_canceled === true;
  const isActive = userData.subscription_active !== false;
  if (subValidUntil) {
    const validUntilMs = new Date(subValidUntil).getTime();
    if (!isNaN(validUntilMs) && nowMs > validUntilMs && (isCanceled || !isActive)) {
      tier = "FREE";
    }
  }
  return tier;
}
function calculatePlatformFeeCents(itemPriceCents, tier) {
  if (!itemPriceCents || itemPriceCents <= 0) return 0;
  let b1Bp = 800;
  let b2Bp = 500;
  let b3Bp = 400;
  if (tier === "PRO") {
    b1Bp = 300;
    b2Bp = 250;
    b3Bp = 200;
  } else if (tier === "BASIC") {
    b1Bp = 650;
    b2Bp = 400;
    b3Bp = 320;
  }
  let totalFeeCents = 0;
  let remaining = itemPriceCents;
  const inB1 = Math.min(remaining, 1e5);
  totalFeeCents += inB1 * b1Bp / 1e4;
  remaining -= inB1;
  if (remaining > 0) {
    const inB2 = Math.min(remaining, 4e5);
    totalFeeCents += inB2 * b2Bp / 1e4;
    remaining -= inB2;
  }
  if (remaining > 0) {
    totalFeeCents += remaining * b3Bp / 1e4;
  }
  let feeCents = Math.round(totalFeeCents);
  const minFeeCents = Math.round(itemPriceCents * 0.02);
  if (feeCents < minFeeCents) {
    feeCents = minFeeCents;
  }
  return feeCents;
}
function getCommissionVat(countryCode, isBusiness, hasValidVatId) {
  const cc = (countryCode || "SI").trim().toUpperCase();
  const isEu = EU_COUNTRIES.has(cc);
  if (!isEu) {
    return { vatRate: 0, isReverseCharge: false };
  }
  if (cc === "SI") {
    return { vatRate: 22, isReverseCharge: false };
  }
  if (isBusiness && hasValidVatId) {
    return { vatRate: 0, isReverseCharge: true };
  }
  return { vatRate: 22, isReverseCharge: false };
}
var STRIPE_CARD_BPS = 190;
var STRIPE_CARD_FIXED_CENTS = 25;
var CONNECT_PAYOUT_BPS = 25;
var CONNECT_PAYOUT_FIXED_CENTS = 10;
var COST_SAFETY_MARGIN_CENTS = 20;
function calculateMinimumFeeCents(itemPriceCents, vatRate) {
  const costs = itemPriceCents * (STRIPE_CARD_BPS + CONNECT_PAYOUT_BPS) / 1e4 + STRIPE_CARD_FIXED_CENTS + CONNECT_PAYOUT_FIXED_CENTS + COST_SAFETY_MARGIN_CENTS;
  const denominator = 1 - STRIPE_CARD_BPS / 1e4 * (1 + vatRate / 100);
  return Math.ceil(costs / denominator);
}
function calculateTotals(params) {
  const { itemPriceCents, tier, countryCode, isBusiness, hasValidVatId } = params;
  const bracketFee = calculatePlatformFeeCents(itemPriceCents, tier);
  const { vatRate, isReverseCharge } = getCommissionVat(countryCode, isBusiness, hasValidVatId);
  const minFee = calculateMinimumFeeCents(itemPriceCents, vatRate);
  const feeCents = Math.max(bracketFee, minFee);
  const vatCents = Math.round(feeCents * vatRate / 100);
  const totalCents = itemPriceCents + feeCents + vatCents;
  const feePercent = itemPriceCents > 0 ? Math.round(feeCents / itemPriceCents * 1e4) / 100 : 0;
  const feeIsMinimum = minFee > bracketFee;
  return {
    itemPriceCents,
    feeCents,
    vatRate,
    vatCents,
    isReverseCharge,
    totalCents,
    feePercent,
    feeIsMinimum
  };
}

// src/server/authHelper.ts
var AuthenticationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthenticationError";
    this.statusCode = 401;
  }
};
async function authenticateFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") {
    throw new AuthenticationError("Missing Authorization header");
  }
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    throw new AuthenticationError("Malformed Authorization header");
  }
  const token = parts[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken || !decodedToken.uid) {
      throw new AuthenticationError("Invalid token payload");
    }
    return decodedToken.uid;
  } catch (err) {
    console.warn("[AUTH] Authentication verification failed");
    throw new AuthenticationError("Invalid or expired token");
  }
}

// src/server/stripeHelper.ts
function formatStripeError(err) {
  const type = err.type || err.raw?.type;
  const code = err.code || err.raw?.code;
  const decline_code = err.decline_code || err.raw?.decline_code;
  const param = err.param || err.raw?.param;
  const requestId = err.requestId || err.raw?.requestId;
  const statusCode = err.statusCode || err.status;
  const rawMessage = err.message || "";
  let userMessage = "Pri obdelavi izpla\u010Dila preko sistema Stripe je pri\u0161lo do napake.";
  if (code === "balance_insufficient" || rawMessage.toLowerCase().includes("insufficient funds")) {
    userMessage = "Nezadostno razpolo\u017Eljivo stanje na platformskem ra\u010Dunu Stripe za izvedbo nakazila.";
  } else if (rawMessage.includes("transfers") && (rawMessage.includes("capabilities") || rawMessage.includes("inactive"))) {
    userMessage = "Prejemni\u0161ki Stripe ra\u010Dun nima aktivne zmo\u017Enosti nakazil ('transfers'). Za prejem sredstev je potrebno zaklju\u010Diti Stripe onboarding.";
  } else if (rawMessage.includes("payouts are not enabled") || rawMessage.includes("payouts_not_enabled")) {
    userMessage = "Izpla\u010Dila na prejemni\u0161kem Stripe ra\u010Dunu \u0161e niso aktivirana.";
  } else if (code === "account_invalid" || rawMessage.includes("No such destination")) {
    userMessage = "Povezani Stripe ra\u010Dun prejemnika ne obstaja ali ni veljaven.";
  } else if (code === "card_declined") {
    userMessage = `Pla\u010Dilo zavrnjeno s strani izdajatelja kartice (${decline_code || "splo\u0161na zavrnitev"}).`;
  } else if (rawMessage) {
    const sanitized = rawMessage.replace(/sk_(test|live)_[0-9a-zA-Z]+/g, "[REDACTED]");
    userMessage = `Stripe napaka: ${sanitized}`;
  }
  return {
    type,
    code,
    decline_code,
    param,
    requestId,
    statusCode,
    userMessage
  };
}
async function ensurePlatformTestBalance(stripe, requiredCents) {
  try {
    const isTestMode = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");
    if (!isTestMode) {
      return { toppedUp: false, availableCents: 0 };
    }
    const balance = await stripe.balance.retrieve();
    const eurAvailable = balance.available.find((b) => b.currency.toLowerCase() === "eur");
    const availableCents = eurAvailable ? eurAvailable.amount : 0;
    if (availableCents < requiredCents) {
      const topupAmount = Math.max(requiredCents * 2, 5e4);
      await stripe.charges.create({
        amount: topupAmount,
        currency: "eur",
        source: "tok_bypassPending",
        description: "Automated test platform balance funding for test transfers"
      });
      return { toppedUp: true, availableCents: availableCents + topupAmount };
    }
    return { toppedUp: false, availableCents };
  } catch (err) {
    console.warn("[ensurePlatformTestBalance] Top-up notice:", err.message);
    return { toppedUp: false, availableCents: 0 };
  }
}
async function diagnoseStripeTransferPrerequisites(stripe, user, amountInCents) {
  const logs = [];
  const issues = [];
  const isTestMode = (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");
  logs.push(`[1] Preverjanje Stripe okolja: ${isTestMode ? "TESTNI NA\u010CIN (sk_test_...)" : "PRODUKCIJSKI NA\u010CIN (sk_live_...)"}`);
  let platformEurCents = 0;
  try {
    const balance = await stripe.balance.retrieve();
    const eurAvailable = balance.available.find((b) => b.currency.toLowerCase() === "eur");
    platformEurCents = eurAvailable ? eurAvailable.amount : 0;
    logs.push(`[2] Stanje platforme Stripe (EUR na voljo): ${(platformEurCents / 100).toFixed(2)} \u20AC`);
    if (platformEurCents < amountInCents) {
      if (isTestMode) {
        logs.push(`[!] Opozorilo: Stanje platforme (${(platformEurCents / 100).toFixed(2)} \u20AC) je ni\u017Eje od zneska izpla\u010Dila (${(amountInCents / 100).toFixed(2)} \u20AC). V testnem na\u010Dinu se bo izvedla samodejna polnitev.`);
      } else {
        issues.push("Nezadostno stanje na platformskem ra\u010Dunu Stripe.");
      }
    }
  } catch (balErr) {
    logs.push(`[2] Napaka pri branju stanja platforme: ${balErr.message}`);
    issues.push(`Preverjanje stanja platforme ni uspelo: ${balErr.message}`);
  }
  const stripeAccountId = user.stripeAccountId || user.stripe_account_id;
  if (!stripeAccountId) {
    logs.push(`[3] Stripe Connect ra\u010Dun: NI POVEZAN (prodajalec nima nastavljenega ra\u010Duna)`);
    issues.push("Stripe ra\u010Dun za izpla\u010Dila ni povezan.");
    return {
      ready: false,
      issues,
      logs,
      details: {
        isTestMode,
        stripeAccountId: null,
        platformEurCents
      }
    };
  }
  logs.push(`[3] Stripe Connect ra\u010Dun najden: ${stripeAccountId}`);
  let stripeAccount = null;
  try {
    stripeAccount = await stripe.accounts.retrieve(stripeAccountId);
    const transfersActive = stripeAccount.capabilities?.transfers === "active";
    const payoutsEnabled = Boolean(stripeAccount.payouts_enabled);
    const chargesEnabled = Boolean(stripeAccount.charges_enabled);
    const detailsSubmitted = Boolean(stripeAccount.details_submitted);
    logs.push(`[4] Podatki ra\u010Duna oddani (details_submitted): ${detailsSubmitted ? "DA" : "NE"}`);
    logs.push(`[5] Zmo\u017Enost nakazil (capabilities.transfers): ${transfersActive ? "AKTIVNA (Active)" : `${stripeAccount.capabilities?.transfers || "inactive"}`}`);
    logs.push(`[6] Izpla\u010Dila omogo\u010Dena (payouts_enabled): ${payoutsEnabled ? "DA" : "NE"}`);
    logs.push(`[7] Pla\u010Dila omogo\u010Dena (charges_enabled): ${chargesEnabled ? "DA" : "NE"}`);
    if (!transfersActive && !payoutsEnabled) {
      issues.push("Prejemni\u0161ki Stripe ra\u010Dun nima aktivnih nakazil ('transfers'). Dokon\u010Dajte onboarding postopek.");
    }
  } catch (acctErr) {
    logs.push(`[4] Napaka pri preverjanju ra\u010Duna ${stripeAccountId}: ${acctErr.message}`);
    issues.push(`Povezanega Stripe ra\u010Duna ni bilo mogo\u010De preveriti: ${acctErr.message}`);
  }
  const ready = issues.length === 0;
  logs.push(`[8] Skupna ocena pripravljenosti za izpla\u010Dilo: ${ready ? "PRIPRAVLJENO" : "POTREBNA DEJANJA"}`);
  return {
    ready,
    issues,
    logs,
    details: {
      isTestMode,
      stripeAccountId,
      platformEurCents,
      accountType: stripeAccount?.type,
      transfersCapability: stripeAccount?.capabilities?.transfers,
      payoutsEnabled: stripeAccount?.payouts_enabled,
      detailsSubmitted: stripeAccount?.details_submitted
    }
  };
}

// src/server/app.ts
var import_cors = __toESM(require("cors"), 1);
var import_stripe = __toESM(require("stripe"), 1);
var import_resend2 = require("resend");
var import_render2 = require("@react-email/render");
var import_react2 = __toESM(require("react"), 1);

// src/emails/AuctionEmailTemplate.tsx
var import_components = require("@react-email/components");
var import_jsx_runtime = require("react/jsx-runtime");
var AuctionEmailTemplate = ({
  type = "outbid",
  recipientName = "Uporabnik",
  auctionTitle = "Predmet dra\u017Ebe",
  auctionImageUrl,
  currentPrice = 0,
  originalPrice,
  endTime,
  paymentDeadline,
  auctionUrl = "https://drazbe.eu",
  paymentUrl,
  settingsUrl = "https://drazbe.eu/?tab=settings",
  bidDifference,
  formattedAmount,
  carrierName,
  trackingNumber
}) => {
  const formattedPrice = formattedAmount || `\u20AC${Number(currentPrice || 0).toLocaleString("sl-SI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  let previewText = "";
  let badgeText = "";
  let badgeBg = "#FEBA4F";
  let badgeColor = "#0A1128";
  let headline = "";
  let subheadline = "";
  let ctaText = "Ogled dra\u017Ebe";
  let ctaUrl = auctionUrl;
  let priceLabel = "Trenutna cena:";
  let highlightNote = "";
  switch (type) {
    case "outbid":
      previewText = `Va\u0161a ponudba za "${auctionTitle}" je bila prese\u017Eena!`;
      badgeText = "PRESE\u017DENA PONUDBA";
      badgeBg = "#EF4444";
      badgeColor = "#FFFFFF";
      headline = "Va\u0161a ponudba je bila prese\u017Eena!";
      subheadline = `Drug uporabnik je pravkar oddal vi\u0161jo ponudbo za artikel "${auctionTitle}". \u0160e vedno imate prilo\u017Enost za zmago!`;
      ctaText = "Oddaj novo ponudbo";
      ctaUrl = auctionUrl;
      priceLabel = "Nova najvi\u0161ja ponudba:";
      highlightNote = "Dra\u017Eba \u0161e traja. Ne dovolite, da vam izdelek uide!";
      break;
    case "ending_soon":
      previewText = `Dra\u017Eba "${auctionTitle}" se kmalu izte\u010De (manj kot 30 min)!`;
      badgeText = "ZADNJA PRILO\u017DNOST";
      badgeBg = "#FEBA4F";
      badgeColor = "#0A1128";
      headline = "Dra\u017Eba se kmalu izte\u010De!";
      subheadline = `Dra\u017Eba za "${auctionTitle}", ki jo spremljate, se bo zaklju\u010Dila v manj kot 30 minutah.`;
      ctaText = "Sodeluj v zaklju\u010Dku";
      ctaUrl = auctionUrl;
      priceLabel = "Trenutna cena:";
      highlightNote = "Pripravite svojo ponudbo pred iztekom \u010Dasa!";
      break;
    case "won":
      previewText = `\u010Cestitamo! Zmagali ste na dra\u017Ebi za "${auctionTitle}"`;
      badgeText = "ZMAGA NA DRA\u017DBI";
      badgeBg = "#10B981";
      badgeColor = "#FFFFFF";
      headline = "\u010Cestitamo, zmagali ste!";
      subheadline = `Uspe\u0161no ste zmagali na dra\u017Ebi za "${auctionTitle}". Za dokon\u010Danje nakupa in prevzem prosimo poravnajte ra\u010Dun v roku 48 ur.`;
      ctaText = "Pojdi na pla\u010Dilo";
      ctaUrl = paymentUrl || `${auctionUrl}?tab=winnings`;
      priceLabel = "Kon\u010Dna zmagovalna cena:";
      highlightNote = "Rok za pla\u010Dilo je 48 ur po zaklju\u010Dku dra\u017Ebe.";
      break;
    case "payment_reminder":
      previewText = `Pomemben opomnik: pla\u010Dilo za "${auctionTitle}" pote\u010De \u010Dez 2 uri!`;
      badgeText = "OPOMNIK ZA PLA\u010CILO";
      badgeBg = "#F59E0B";
      badgeColor = "#FFFFFF";
      headline = "Rok za pla\u010Dilo se kmalu izte\u010De!";
      subheadline = `Obve\u0161\u010Damo vas, da se rok za pla\u010Dilo zmagovalne dra\u017Ebe "${auctionTitle}" izte\u010De v manj kot 2 urah.`;
      ctaText = "Pla\u010Daj zdaj";
      ctaUrl = paymentUrl || `${auctionUrl}?tab=winnings`;
      priceLabel = "Znesek za pla\u010Dilo:";
      highlightNote = "Po izteku roka se artikel lahko ponudi drugemu ponudniku, ra\u010Dun pa prejme opomin.";
      break;
    case "payment_success":
      previewText = `Pla\u010Dilo za "${auctionTitle}" je bilo uspe\u0161no obdelano.`;
      badgeText = "PLA\u010CILO USPE\u0160NO";
      badgeBg = "#10B981";
      badgeColor = "#FFFFFF";
      headline = "Va\u0161e pla\u010Dilo je bilo uspe\u0161no!";
      subheadline = `Pla\u010Dilo za dra\u017Ebo "${auctionTitle}" je bilo uspe\u0161no obdelano. V priponki tega sporo\u010Dila vam po\u0161iljamo ra\u010Dun za opravljeno storitev ter potrdilo o nakupu (kupoprodajno pogodbo).`;
      ctaText = "Status naro\u010Dila";
      ctaUrl = auctionUrl || "https://drazbe.eu";
      priceLabel = "Pla\u010Dan znesek:";
      highlightNote = "Dokumenti so prilo\u017Eeni k temu sporo\u010Dilu v PDF obliki.";
      break;
    case "payment_received_seller":
      previewText = `Prejeto pla\u010Dilo za va\u0161o dra\u017Ebo "${auctionTitle}"!`;
      badgeText = "PREJETO PLA\u010CILO";
      badgeBg = "#10B981";
      badgeColor = "#FFFFFF";
      headline = "Imate novo pla\u010Dilo!";
      subheadline = `Kupec je uspe\u0161no pla\u010Dal za artikel "${auctionTitle}". Predmet morate odposlati ali predati v roku 7 dni. Sredstva so varno shranjena v escrow hrambi do potrditve prejema.`;
      ctaText = "Status naro\u010Dila";
      ctaUrl = auctionUrl || "https://drazbe.eu";
      priceLabel = "Prejeti znesek:";
      highlightNote = `Rok za odpremo: ${paymentDeadline || "7 dni"}.`;
      break;
    case "item_shipped_buyer":
      previewText = `Va\u0161 predmet "${auctionTitle}" je bil poslan!`;
      badgeText = "PREDMET POSLAN";
      badgeBg = "#3B82F6";
      badgeColor = "#FFFFFF";
      headline = "Va\u0161 predmet je na poti!";
      subheadline = `Prodajalec je ozna\u010Dil, da je predmet "${auctionTitle}" oddan na po\u0161to. ${carrierName ? `Prevoznik: ${carrierName}.` : ""} ${trackingNumber ? `Sledilna \u0161tevilka: ${trackingNumber}.` : ""}`;
      ctaText = "Status naro\u010Dila";
      ctaUrl = auctionUrl || "https://drazbe.eu";
      priceLabel = "Artikel:";
      highlightNote = "Ko predmet prejmete, prosimo potrdite prejem na platformi.";
      break;
    case "item_delivered_buyer":
      previewText = `Ste prejeli predmet "${auctionTitle}"? Potrdite prejem!`;
      badgeText = "POTRDITE PREJEM";
      badgeBg = "#FEBA4F";
      badgeColor = "#0A1128";
      headline = "Je predmet prispel?";
      subheadline = `Predmet "${auctionTitle}" bi moral biti \u017Ee pri vas. Prosimo, da na platformi potrdite prejem, da lahko sprostimo izpla\u010Dilo prodajalcu. V primeru te\u017Eav lahko odprete spor.`;
      ctaText = "Potrdi prejem";
      ctaUrl = auctionUrl || "https://drazbe.eu";
      priceLabel = "Artikel:";
      highlightNote = "\u010Ce prejema ne potrdite ro\u010Dno, se bo po dolo\u010Denem \u010Dasu potrdil samodejno.";
      break;
    case "item_delivered_seller":
      previewText = `Prejem predmeta "${auctionTitle}" je bil potrjen!`;
      badgeText = "PREJEM POTRJEN";
      badgeBg = "#10B981";
      badgeColor = "#FFFFFF";
      headline = "Kupec je potrdil prejem!";
      subheadline = `Kupec je potrdil prejem predmeta "${auctionTitle}". Izpla\u010Dilo na va\u0161 Stripe ra\u010Dun bo spro\u017Eeno samodejno \u010Dez 2 dni, \u010De ne bo vlo\u017Eenih prito\u017Eb.`;
      ctaText = "Status naro\u010Dila";
      ctaUrl = auctionUrl || "https://drazbe.eu";
      priceLabel = "Znesek izpla\u010Dila:";
      highlightNote = "Sredstva bodo kmalu na va\u0161em ra\u010Dunu.";
      break;
    case "review_reminder":
      previewText = `Kako ste zadovoljni z nakupom predmeta "${auctionTitle}"? Oddajte oceno!`;
      badgeText = "OCENITE PRODAJALCA";
      badgeBg = "#FEBA4F";
      badgeColor = "#0A1128";
      headline = "Kako ste zadovoljni z nakupom?";
      subheadline = `Minilo je 24 ur od potrditve prejema predmeta "${auctionTitle}". Va\u0161a ocena in mnenje o prodajalcu sta izjemno pomembna za transparentnost in varnost celotne skupnosti.`;
      ctaText = "Oddaj oceno prodajalca";
      ctaUrl = paymentUrl || `${auctionUrl}?tab=winnings`;
      priceLabel = "Kupljen artikel:";
      highlightNote = "Oddaja ocene vzame manj kot minuto (1\u20135 zvezdic ter po \u017Eelji kratek komentar).";
      break;
    case "shipping_cancelled_buyer":
      previewText = `Naro\u010Dilo za "${auctionTitle}" je bilo preklicano.`;
      badgeText = "NARO\u010CILO PREKLICANO";
      badgeBg = "#EF4444";
      badgeColor = "#FFFFFF";
      headline = "Naro\u010Dilo preklicano";
      subheadline = `Naro\u010Dilo je bilo preklicano, ker prodajalec predmeta ni poslal v roku. Znesek vam vrnemo v celoti, vklju\u010Dno s provizijo.`;
      ctaText = "Ogled drazbe";
      priceLabel = "Vrnjeni znesek:";
      highlightNote = "Sredstva bodo vrnjena na va\u0161 pla\u010Dilni ra\u010Dun.";
      break;
    case "shipping_cancelled_seller":
      previewText = `Va\u0161a prodaja za "${auctionTitle}" je bila preklicana.`;
      badgeText = "PRODAJA PREKLICANA";
      badgeBg = "#EF4444";
      badgeColor = "#FFFFFF";
      headline = "Prodaja preklicana";
      subheadline = `Naro\u010Dilo za "${auctionTitle}" je bilo preklicano, ker predmeta niste odposlali v predvidenem roku. Zaradi kr\u0161itve pogojev uporabe vam je bil dodeljen opomin (strike).`;
      ctaText = "Pravila poslovanja";
      priceLabel = "Artikel:";
      highlightNote = "Prosimo, da v prihodnje predmete odpo\u0161ljete pravo\u010Dasno.";
      break;
  }
  const fallbackImage = "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=60";
  const displayImage = auctionImageUrl || fallbackImage;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Html, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Head, {}),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Preview, { children: previewText }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Body, { style: main, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Container, { style: container, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Section, { style: headerSection, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Row, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Column, { align: "center", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Text, { style: logoText, children: [
          "dra\u017Ebenik",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: logoAccent, children: ".si" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: taglineText, children: "Slovenska dra\u017Ebena platforma" })
      ] }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Section, { style: cardSection, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Row, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Column, { align: "center", style: { paddingTop: "16px" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              ...badgeStyle,
              backgroundColor: badgeBg,
              color: badgeColor
            },
            children: badgeText
          }
        ) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Heading, { style: headingStyle, children: headline }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Text, { style: greetingText, children: [
          "Pozdravljeni, ",
          recipientName,
          ","
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: paragraphStyle, children: subheadline }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Section, { style: itemCardStyle, children: [
          displayImage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_components.Img,
            {
              src: displayImage,
              alt: auctionTitle,
              width: "100%",
              style: itemImageStyle
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Section, { style: { padding: "20px" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: itemTitleStyle, children: auctionTitle }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Hr, { style: dividerStyle }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Row, { style: { marginTop: "12px" }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Column, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: priceLabelStyle, children: priceLabel }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: priceValueStyle, children: formattedPrice })
              ] }),
              endTime && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Column, { align: "right", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: priceLabelStyle, children: "\u010Cas do konca:" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: endTimeValueStyle, children: endTime })
              ] }),
              paymentDeadline && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Column, { align: "right", children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: priceLabelStyle, children: "Rok za pla\u010Dilo:" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: deadlineValueStyle, children: paymentDeadline })
              ] })
            ] })
          ] })
        ] }),
        highlightNote && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Section, { style: noticeBoxStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Text, { style: noticeTextStyle, children: highlightNote }) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Section, { style: { textAlign: "center", marginTop: "28px", marginBottom: "24px" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          import_components.Button,
          {
            href: ctaUrl,
            target: "_blank",
            style: ctaButtonStyle,
            children: [
              ctaText,
              " \u2192"
            ]
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Text, { style: securityNoticeStyle, children: [
          "\u010Ce gumb ne deluje, kopirajte naslednjo povezavo v brskalnik:",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Link, { href: ctaUrl, target: "_blank", style: linkStyle, children: ctaUrl })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Section, { style: footerSection, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Text, { style: footerText, children: [
          "To je samodejno sistemsko obvestilo spletne platforme",
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Link, { href: "https://drazbe.eu", target: "_blank", style: footerLink, children: "dra\u017Ebenik.si" }),
          "."
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Text, { style: footerSubText, children: [
          "Nastavitve prejemanja e-po\u0161tnih obvestil lahko kadar koli uredite v svojem",
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_components.Link, { href: settingsUrl, target: "_blank", style: footerLink, children: "uporabni\u0161kem profilu" }),
          "."
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_components.Text, { style: copyrightText, children: [
          "\xA9 ",
          (/* @__PURE__ */ new Date()).getFullYear(),
          " dra\u017Ebenik.si. Vse pravice pridr\u017Eane."
        ] })
      ] })
    ] }) })
  ] });
};
var main = {
  backgroundColor: "#050914",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
  margin: "0 auto",
  padding: "40px 10px"
};
var container = {
  maxWidth: "580px",
  margin: "0 auto"
};
var headerSection = {
  textAlign: "center",
  paddingBottom: "24px"
};
var logoText = {
  fontSize: "28px",
  fontWeight: "900",
  color: "#FFFFFF",
  letterSpacing: "-0.5px",
  margin: "0",
  textTransform: "lowercase"
};
var logoAccent = {
  color: "#FEBA4F"
};
var taglineText = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#94A3B8",
  letterSpacing: "1px",
  textTransform: "uppercase",
  margin: "4px 0 0 0"
};
var cardSection = {
  backgroundColor: "#0A1128",
  borderRadius: "24px",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  padding: "24px 28px",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)"
};
var badgeStyle = {
  display: "inline-block",
  padding: "6px 14px",
  borderRadius: "9999px",
  fontSize: "11px",
  fontWeight: "900",
  letterSpacing: "1px",
  textTransform: "uppercase"
};
var headingStyle = {
  color: "#FFFFFF",
  fontSize: "22px",
  fontWeight: "800",
  textAlign: "center",
  margin: "16px 0 8px 0",
  letterSpacing: "-0.5px"
};
var greetingText = {
  color: "#FEBA4F",
  fontSize: "14px",
  fontWeight: "700",
  margin: "16px 0 6px 0"
};
var paragraphStyle = {
  color: "#CBD5E1",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 20px 0"
};
var itemCardStyle = {
  backgroundColor: "#111C3D",
  borderRadius: "18px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  overflow: "hidden",
  margin: "16px 0"
};
var itemImageStyle = {
  width: "100%",
  maxHeight: "220px",
  objectFit: "cover",
  display: "block",
  borderTopLeftRadius: "18px",
  borderTopRightRadius: "18px"
};
var itemTitleStyle = {
  color: "#FFFFFF",
  fontSize: "16px",
  fontWeight: "800",
  margin: "0 0 8px 0",
  lineHeight: "1.4"
};
var dividerStyle = {
  borderColor: "rgba(255, 255, 255, 0.08)",
  margin: "12px 0"
};
var priceLabelStyle = {
  color: "#94A3B8",
  fontSize: "11px",
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  margin: "0 0 2px 0"
};
var priceValueStyle = {
  color: "#FEBA4F",
  fontSize: "22px",
  fontWeight: "900",
  margin: "0"
};
var endTimeValueStyle = {
  color: "#F87171",
  fontSize: "14px",
  fontWeight: "800",
  margin: "0"
};
var deadlineValueStyle = {
  color: "#FBBF24",
  fontSize: "14px",
  fontWeight: "800",
  margin: "0"
};
var noticeBoxStyle = {
  backgroundColor: "rgba(254, 186, 79, 0.08)",
  borderRadius: "12px",
  border: "1px solid rgba(254, 186, 79, 0.25)",
  padding: "12px 16px",
  margin: "16px 0"
};
var noticeTextStyle = {
  color: "#FEBA4F",
  fontSize: "12px",
  fontWeight: "600",
  margin: "0",
  textAlign: "center"
};
var ctaButtonStyle = {
  backgroundColor: "#FEBA4F",
  color: "#0A1128",
  padding: "16px 36px",
  borderRadius: "14px",
  fontSize: "14px",
  fontWeight: "900",
  textTransform: "uppercase",
  letterSpacing: "1px",
  textDecoration: "none",
  display: "inline-block",
  boxShadow: "0 8px 24px rgba(254, 186, 79, 0.35)"
};
var securityNoticeStyle = {
  color: "#64748B",
  fontSize: "11px",
  textAlign: "center",
  margin: "16px 0 0 0",
  lineHeight: "1.5"
};
var linkStyle = {
  color: "#FEBA4F",
  textDecoration: "underline",
  wordBreak: "break-all"
};
var footerSection = {
  textAlign: "center",
  paddingTop: "24px"
};
var footerText = {
  color: "#64748B",
  fontSize: "12px",
  margin: "0 0 6px 0"
};
var footerSubText = {
  color: "#475569",
  fontSize: "11px",
  margin: "0 0 12px 0"
};
var footerLink = {
  color: "#94A3B8",
  textDecoration: "underline"
};
var copyrightText = {
  color: "#334155",
  fontSize: "11px",
  margin: "0"
};

// src/emails/AuthEmailTemplate.tsx
var import_components2 = require("@react-email/components");
var import_jsx_runtime2 = require("react/jsx-runtime");
var AuthEmailTemplate = ({
  type = "verify_email",
  recipientName = "Uporabnik",
  actionUrl = "https://drazbe.eu"
}) => {
  let previewText = "";
  let badgeText = "";
  let badgeBg = "#FEBA4F";
  let badgeColor = "#0A1128";
  let headline = "";
  let subheadline = "";
  let ctaText = "";
  let highlightNote = "";
  switch (type) {
    case "verify_email":
      previewText = "Potrdite svoj e-po\u0161tni naslov za dra\u017Ebenik.si";
      badgeText = "POTRDITEV E-PO\u0160TE";
      badgeBg = "#3B82F6";
      badgeColor = "#FFFFFF";
      headline = "Dobrodo\u0161li na dra\u017Ebenik.si!";
      subheadline = "Hvala za registracijo. Da bi lahko v celoti uporabljali platformo in sodelovali na dra\u017Ebah, prosimo potrdite svoj e-po\u0161tni naslov.";
      ctaText = "Potrdi e-po\u0161tni naslov";
      highlightNote = "Povezava je veljavna omejen \u010Das.";
      break;
    case "reset_password":
      previewText = "Ponastavitev gesla za va\u0161 dra\u017Ebenik.si ra\u010Dun";
      badgeText = "PONASTAVITEV GESLA";
      badgeBg = "#EF4444";
      badgeColor = "#FFFFFF";
      headline = "Zahteva za ponastavitev gesla";
      subheadline = "Prejeli smo zahtevo za ponastavitev gesla va\u0161ega uporabni\u0161kega ra\u010Duna. \u010Ce ste to zahtevali vi, kliknite spodnji gumb za nastavitev novega gesla.";
      ctaText = "Ponastavi geslo";
      highlightNote = "\u010Ce te zahteve niste oddali vi, lahko to sporo\u010Dilo varno ignorirate.";
      break;
    case "email_changed":
      previewText = "Va\u0161 e-po\u0161tni naslov je bil spremenjen";
      badgeText = "SPREMEMBA PODATKOV";
      badgeBg = "#10B981";
      badgeColor = "#FFFFFF";
      headline = "Sprememba e-po\u0161tnega naslova";
      subheadline = "Obve\u0161\u010Damo vas, da je bil e-po\u0161tni naslov va\u0161ega ra\u010Duna uspe\u0161no spremenjen. \u010Ce ste to spremembo opravili vi, ni potrebna nobena nadaljnja akcija.";
      ctaText = "Prijavi se z novim naslovom";
      highlightNote = "\u010Ce te spremembe niste opravili vi, nemudoma kontaktirajte na\u0161o podporo.";
      break;
    case "mfa_enrollment":
      previewText = "Obvestilo o varnostnih nastavitvah ra\u010Duna (MFA)";
      badgeText = "VARNOSTNO OBVESTILO";
      badgeBg = "#8B5CF6";
      badgeColor = "#FFFFFF";
      headline = "Posodobitev varnostnih nastavitev";
      subheadline = "Obve\u0161\u010Damo vas o spremembi nastavitev dvostopenjske avtentikacije (MFA) na va\u0161em uporabni\u0161kem ra\u010Dunu. Va\u0161 ra\u010Dun je zdaj dodatno za\u0161\u010Diten.";
      ctaText = "Preglej nastavitve ra\u010Duna";
      highlightNote = "Dvostopenjska avtentikacija mo\u010Dno izbolj\u0161a varnost va\u0161ega ra\u010Duna.";
      break;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Html, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Head, {}),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Preview, { children: previewText }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Body, { style: main2, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Container, { style: container2, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Section, { style: headerSection2, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Row, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Column, { align: "center", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Text, { style: logoText2, children: [
          "dra\u017Ebenik",
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: logoAccent2, children: ".si" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Text, { style: taglineText2, children: "Slovenska dra\u017Ebena platforma" })
      ] }) }) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Section, { style: cardSection2, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Row, { children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Column, { align: "center", style: { paddingTop: "16px" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          "span",
          {
            style: {
              ...badgeStyle2,
              backgroundColor: badgeBg,
              color: badgeColor
            },
            children: badgeText
          }
        ) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Heading, { style: headingStyle2, children: headline }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Text, { style: greetingText2, children: [
          "Pozdravljeni, ",
          recipientName,
          ","
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Text, { style: paragraphStyle2, children: subheadline }),
        highlightNote && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Section, { style: noticeBoxStyle2, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Text, { style: noticeTextStyle2, children: highlightNote }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Section, { style: { textAlign: "center", marginTop: "28px", marginBottom: "24px" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
          import_components2.Button,
          {
            href: actionUrl,
            target: "_blank",
            style: ctaButtonStyle2,
            children: [
              ctaText,
              " \u2192"
            ]
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Text, { style: securityNoticeStyle2, children: [
          "\u010Ce gumb ne deluje, kopirajte naslednjo povezavo v brskalnik:",
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("br", {}),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Link, { href: actionUrl, target: "_blank", style: linkStyle2, children: actionUrl })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Section, { style: footerSection2, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Text, { style: footerText2, children: [
          "To je samodejno sistemsko obvestilo spletne platforme",
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_components2.Link, { href: "https://drazbe.eu", target: "_blank", style: footerLink2, children: "dra\u017Ebenik.si" }),
          "."
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_components2.Text, { style: copyrightText2, children: [
          "\xA9 ",
          (/* @__PURE__ */ new Date()).getFullYear(),
          " dra\u017Ebenik.si. Vse pravice pridr\u017Eane."
        ] })
      ] })
    ] }) })
  ] });
};
var main2 = {
  backgroundColor: "#050914",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
  margin: "0 auto",
  padding: "40px 10px"
};
var container2 = {
  maxWidth: "580px",
  margin: "0 auto"
};
var headerSection2 = {
  textAlign: "center",
  paddingBottom: "24px"
};
var logoText2 = {
  fontSize: "28px",
  fontWeight: "900",
  color: "#FFFFFF",
  letterSpacing: "-0.5px",
  margin: "0",
  textTransform: "lowercase"
};
var logoAccent2 = {
  color: "#FEBA4F"
};
var taglineText2 = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#94A3B8",
  letterSpacing: "1px",
  textTransform: "uppercase",
  margin: "4px 0 0 0"
};
var cardSection2 = {
  backgroundColor: "#0A1128",
  borderRadius: "24px",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  padding: "24px 28px",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.5)"
};
var badgeStyle2 = {
  display: "inline-block",
  padding: "6px 14px",
  borderRadius: "9999px",
  fontSize: "11px",
  fontWeight: "900",
  letterSpacing: "1px",
  textTransform: "uppercase"
};
var headingStyle2 = {
  color: "#FFFFFF",
  fontSize: "22px",
  fontWeight: "800",
  textAlign: "center",
  margin: "16px 0 8px 0",
  letterSpacing: "-0.5px"
};
var greetingText2 = {
  color: "#FEBA4F",
  fontSize: "14px",
  fontWeight: "700",
  margin: "16px 0 6px 0"
};
var paragraphStyle2 = {
  color: "#CBD5E1",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 20px 0"
};
var noticeBoxStyle2 = {
  backgroundColor: "rgba(254, 186, 79, 0.08)",
  borderRadius: "12px",
  border: "1px solid rgba(254, 186, 79, 0.25)",
  padding: "12px 16px",
  margin: "16px 0"
};
var noticeTextStyle2 = {
  color: "#FEBA4F",
  fontSize: "12px",
  fontWeight: "600",
  margin: "0",
  textAlign: "center"
};
var ctaButtonStyle2 = {
  backgroundColor: "#FEBA4F",
  color: "#0A1128",
  padding: "16px 36px",
  borderRadius: "14px",
  fontSize: "14px",
  fontWeight: "900",
  textTransform: "uppercase",
  letterSpacing: "1px",
  textDecoration: "none",
  display: "inline-block",
  boxShadow: "0 8px 24px rgba(254, 186, 79, 0.35)"
};
var securityNoticeStyle2 = {
  color: "#64748B",
  fontSize: "11px",
  textAlign: "center",
  margin: "16px 0 0 0",
  lineHeight: "1.5"
};
var linkStyle2 = {
  color: "#FEBA4F",
  textDecoration: "underline",
  wordBreak: "break-all"
};
var footerSection2 = {
  textAlign: "center",
  paddingTop: "24px"
};
var footerText2 = {
  color: "#64748B",
  fontSize: "12px",
  margin: "0 0 6px 0"
};
var footerLink2 = {
  color: "#94A3B8",
  textDecoration: "underline"
};
var copyrightText2 = {
  color: "#334155",
  fontSize: "11px",
  margin: "0"
};

// src/server/app.ts
var import_genai = require("@google/genai");

// src/server/publicProfile.ts
async function syncPublicProfile(uid) {
  try {
    if (!uid) return;
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) return;
    const user = userDoc.data() || {};
    const userType = user.user_type || user.userType || "individual";
    const companyName = (user.company_name || user.companyName || "").trim();
    const username = (user.username || user.userName || "").trim();
    const firstName = (user.first_name || user.firstName || "").trim();
    const lastName = (user.last_name || user.lastName || "").trim();
    let displayName = "";
    if (userType === "business" && companyName) {
      displayName = companyName;
    } else if (username) {
      displayName = username;
    } else if (firstName) {
      const lastInitial = lastName ? ` ${lastName.charAt(0).toUpperCase()}.` : "";
      displayName = `${firstName}${lastInitial}`;
    }
    const photoUrl = user.profile_picture_url || user.profilePicture || user.photo_url || user.photoURL || null;
    const city = user.city || user.company_city || user.companyCity || null;
    const description = user.description || null;
    const createdAt = user.created_at || user.createdAt || (/* @__PURE__ */ new Date()).toISOString();
    const soldCount = typeof user.sold_count === "number" ? user.sold_count : typeof user.soldCount === "number" ? user.soldCount : 0;
    const unpaidPenalties = Number(user.unpaidStrikes ?? user.unpaid_penalties ?? user.unpaidPenalties ?? 0);
    const identityVerified = user.identity_verified === true;
    const isDeleted = Boolean(user.is_deleted || user.isDeleted);
    const publicProfileData = {
      username: username || null,
      display_name: displayName || "Uporabnik",
      user_type: userType,
      company_name: companyName || null,
      photo_url: photoUrl,
      city: city || null,
      description: description || null,
      created_at: createdAt,
      sold_count: soldCount,
      unpaid_penalties: unpaidPenalties,
      identity_verified: identityVerified,
      is_deleted: isDeleted,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await adminDb.collection("public_profiles").doc(uid).set(publicProfileData, { merge: true });
  } catch (err) {
    console.error(`[syncPublicProfile] Error syncing for user ${uid}:`, err);
  }
}

// src/server/emailService.ts
var import_react = __toESM(require("react"), 1);
var import_resend = require("resend");
var import_render = require("@react-email/render");
var resendClient = null;
function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[EMAIL] RESEND_API_KEY environment variable is not configured. Email will be logged to console.");
    return null;
  }
  if (!resendClient) {
    resendClient = new import_resend.Resend(apiKey);
  }
  return resendClient;
}
function getBaseAppUrl() {
  const configured = process.env.APP_URL || process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured && !configured.includes("drazbenik.si")) {
    return configured;
  }
  return "https://drazbe.eu";
}
function getEmailFrom() {
  return process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>";
}
async function sendAuctionEmail(to, subject, templateProps) {
  if (!to || !to.includes("@")) {
    console.warn(`[EMAIL] Invalid recipient email: ${to}`);
    return { success: false, error: "Invalid recipient email" };
  }
  try {
    const html = await (0, import_render.render)(import_react.default.createElement(AuctionEmailTemplate, templateProps));
    const resend = getResend();
    const from = getEmailFrom();
    if (!resend) {
      console.log(`[EMAIL SIMULATION] To: ${to} | Subject: "${subject}" | Type: ${templateProps.type}`);
      return { success: true, id: "simulated_" + Date.now() };
    }
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html
    });
    if (error) {
      console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error);
      return { success: false, error: error.message };
    }
    console.log(`[EMAIL SENT] Successfully sent ${templateProps.type} email to ${to}, ID: ${data?.id}`);
    return { success: true, id: data?.id };
  } catch (err) {
    console.error(`[EMAIL EXCEPTION] Error sending email to ${to}:`, err);
    return { success: false, error: err.message };
  }
}
async function sendOutbidNotification(params) {
  const baseUrl = getBaseAppUrl();
  const auctionUrl = `${baseUrl}/?drazba=${params.auctionId}`;
  const subject = `\u26A0\uFE0F Prese\u017Eena ponudba: ${params.auctionTitle} - dra\u017Ebenik.si`;
  return sendAuctionEmail(params.toEmail, subject, {
    type: "outbid",
    recipientName: params.recipientName || "Spo\u0161tovani uporabnik",
    auctionTitle: params.auctionTitle,
    auctionImageUrl: params.auctionImageUrl,
    currentPrice: params.newPrice,
    auctionUrl,
    settingsUrl: `${baseUrl}/?tab=settings`
  });
}
async function sendEndingSoonNotification(params) {
  const baseUrl = getBaseAppUrl();
  const auctionUrl = `${baseUrl}/?drazba=${params.auctionId}`;
  const subject = `\u23F3 Kmalu se izte\u010De: ${params.auctionTitle} - dra\u017Ebenik.si`;
  return sendAuctionEmail(params.toEmail, subject, {
    type: "ending_soon",
    recipientName: params.recipientName || "Spo\u0161tovani uporabnik",
    auctionTitle: params.auctionTitle,
    auctionImageUrl: params.auctionImageUrl,
    currentPrice: params.currentPrice,
    endTime: params.endTimeFormatted || "manj kot 30 minut",
    auctionUrl,
    settingsUrl: `${baseUrl}/?tab=settings`
  });
}
async function sendAuctionWonNotification(params) {
  const baseUrl = getBaseAppUrl();
  const auctionUrl = `${baseUrl}/?drazba=${params.auctionId}`;
  const paymentUrl = `${baseUrl}/?tab=winnings&pay=${params.auctionId}`;
  const subject = `\u{1F3C6} \u010Cestitamo! Zmagali ste na dra\u017Ebi: ${params.auctionTitle} - dra\u017Ebenik.si`;
  return sendAuctionEmail(params.toEmail, subject, {
    type: "won",
    recipientName: params.recipientName || "Zmagovalec",
    auctionTitle: params.auctionTitle,
    auctionImageUrl: params.auctionImageUrl,
    currentPrice: params.winningPrice,
    paymentDeadline: params.paymentDeadlineFormatted || "48 ur",
    auctionUrl,
    paymentUrl,
    settingsUrl: `${baseUrl}/?tab=settings`
  });
}
async function sendPaymentReminderNotification(params) {
  const baseUrl = getBaseAppUrl();
  const auctionUrl = `${baseUrl}/?drazba=${params.auctionId}`;
  const paymentUrl = `${baseUrl}/?tab=winnings&pay=${params.auctionId}`;
  const subject = `\u23F0 Zadnji opomnik za pla\u010Dilo: ${params.auctionTitle} - dra\u017Ebenik.si`;
  return sendAuctionEmail(params.toEmail, subject, {
    type: "payment_reminder",
    recipientName: params.recipientName || "Spo\u0161tovani kupec",
    auctionTitle: params.auctionTitle,
    auctionImageUrl: params.auctionImageUrl,
    currentPrice: params.amount,
    paymentDeadline: params.paymentDeadlineFormatted || "manj kot 2 uri",
    auctionUrl,
    paymentUrl,
    settingsUrl: `${baseUrl}/?tab=settings`
  });
}
async function sendReviewReminderNotification(params) {
  const baseUrl = getBaseAppUrl();
  const auctionUrl = `${baseUrl}/?drazba=${params.auctionId}`;
  const reviewUrl = `${baseUrl}/?tab=winnings`;
  const subject = `\u2B50 Kako ste zadovoljni z nakupom: ${params.auctionTitle}? - dra\u017Ebenik.si`;
  return sendAuctionEmail(params.toEmail, subject, {
    type: "review_reminder",
    recipientName: params.recipientName || "Spo\u0161tovani kupec",
    auctionTitle: params.auctionTitle,
    auctionImageUrl: params.auctionImageUrl,
    currentPrice: 0,
    auctionUrl,
    paymentUrl: reviewUrl,
    settingsUrl: `${baseUrl}/?tab=settings`
  });
}
async function sendShippingCancelledNotifications(params) {
  const baseUrl = getBaseAppUrl();
  const auctionUrl = `${baseUrl}/?drazba=${params.auctionId}`;
  const buyerRes = await sendAuctionEmail(params.buyerEmail, `Naro\u010Dilo preklicano: ${params.auctionTitle}`, {
    type: "shipping_cancelled_buyer",
    recipientName: params.buyerName || "Kupec",
    auctionTitle: params.auctionTitle,
    auctionImageUrl: params.auctionImageUrl,
    currentPrice: params.totalAmount,
    auctionUrl,
    settingsUrl: `${baseUrl}/?tab=settings`
  });
  const sellerRes = await sendAuctionEmail(params.sellerEmail, `Prodaja preklicana: ${params.auctionTitle}`, {
    type: "shipping_cancelled_seller",
    recipientName: params.sellerName || "Prodajalec",
    auctionTitle: params.auctionTitle,
    auctionImageUrl: params.auctionImageUrl,
    currentPrice: params.totalAmount,
    auctionUrl,
    settingsUrl: `${baseUrl}/?tab=settings`
  });
  return {
    buyerSuccess: buyerRes.success,
    sellerSuccess: sellerRes.success
  };
}

// src/server/cronProcessor.ts
async function finalizeAuction(auctionId) {
  if (!auctionId) return { finalized: false };
  const auctionRef = adminDb.collection("auctions").doc(auctionId);
  const now = /* @__PURE__ */ new Date();
  const nowIso = now.toISOString();
  let finalizedData = null;
  try {
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(auctionRef);
      if (!snap.exists) return;
      const data = snap.data() || {};
      if (data.status !== "active") {
        return;
      }
      const endTimeStr = data.end_time || data.endTime;
      if (!endTimeStr) return;
      const endTime = new Date(endTimeStr).getTime();
      if (endTime > now.getTime()) {
        return;
      }
      const hasBids = (data.bid_count > 0 || data.bidCount > 0) && (data.winner_id || data.winnerId);
      const title = data.title?.SLO || data.title?.EN || (typeof data.title === "string" ? data.title : "Predmet dra\u017Ebe");
      const imageUrl = Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : void 0;
      const finalPrice = Number(data.current_price ?? data.currentBid ?? 0);
      const sellerId = data.seller_id || data.sellerId;
      if (hasBids) {
        const winnerId = data.winner_id || data.winnerId;
        const paymentDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1e3).toISOString();
        transaction.update(auctionRef, {
          status: "completed",
          post_auction_status: "awaiting_payment_1st",
          payment_deadline: paymentDeadline,
          winner_notified: true,
          ended_at: nowIso,
          finalized_at: nowIso
        });
        finalizedData = {
          finalized: true,
          post_auction_status: "awaiting_payment_1st",
          status: "completed",
          auctionId,
          title,
          imageUrl,
          finalPrice,
          winnerId,
          paymentDeadline,
          sellerId
        };
      } else {
        transaction.update(auctionRef, {
          status: "completed",
          post_auction_status: "unsold",
          winner_notified: true,
          ended_at: nowIso,
          finalized_at: nowIso
        });
        finalizedData = {
          finalized: true,
          post_auction_status: "unsold",
          status: "completed",
          auctionId,
          sellerId
        };
      }
    });
  } catch (txErr) {
    console.error(`[finalizeAuction] Transaction error for auction ${auctionId}:`, txErr.message);
  }
  if (finalizedData && finalizedData.finalized) {
    if (finalizedData.winnerId) {
      try {
        const winnerSnap = await adminDb.collection("users").doc(finalizedData.winnerId).get();
        if (isDocSnapshotExists(winnerSnap)) {
          const winnerData = getDocSnapshotData(winnerSnap) || {};
          if (winnerData.email) {
            const pd = finalizedData.paymentDeadline;
            await sendAuctionWonNotification({
              toEmail: winnerData.email,
              recipientName: winnerData.first_name || winnerData.name || "Zmagovalec",
              auctionId,
              auctionTitle: finalizedData.title,
              auctionImageUrl: finalizedData.imageUrl,
              winningPrice: finalizedData.finalPrice,
              paymentDeadlineFormatted: pd ? "48 ur (do " + new Date(pd).toLocaleDateString("sl-SI", { day: "2-digit", month: "2-digit" }) + " ob " + new Date(pd).toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" }) + ")" : "48 ur"
            });
          }
        }
      } catch (winErr) {
        console.error(`[finalizeAuction] Error notifying winner ${finalizedData.winnerId}:`, winErr.message);
      }
    }
  }
  return finalizedData || { finalized: false };
}
async function processAuctionCrons() {
  const now = /* @__PURE__ */ new Date();
  const nowIso = now.toISOString();
  const details = [];
  const result = {
    success: true,
    timestamp: nowIso,
    actions: {
      reminders30mSent: 0,
      auctionsEnded: 0,
      winnersNotified: 0,
      unsoldUpdated: 0,
      paymentRemindersSent: 0,
      expired1stProcessed: 0,
      reviewRemindersSent: 0
    },
    details
  };
  try {
    const plus30Iso = new Date(now.getTime() + 30 * 60 * 1e3).toISOString();
    let remindersSnap;
    try {
      remindersSnap = await adminDb.collection("auctions").where("status", "==", "active").where("end_time", ">=", nowIso).where("end_time", "<=", plus30Iso).limit(100).get();
    } catch (e) {
      console.warn("[CRON] Failed to fetch 30m reminder auctions:", e.message);
      remindersSnap = { empty: true, docs: [] };
    }
    for (const auctionDoc of remindersSnap.docs) {
      const data = auctionDoc.data();
      if (data.reminder_30m_sent) continue;
      const endTimeStr = data.end_time || data.endTime;
      if (!endTimeStr) continue;
      const endTime = new Date(endTimeStr).getTime();
      const diffMs = endTime - now.getTime();
      if (diffMs > 0 && diffMs <= 30 * 60 * 1e3) {
        const auctionId = auctionDoc.id;
        const title = data.title?.SLO || data.title?.EN || (typeof data.title === "string" ? data.title : "Predmet dra\u017Ebe");
        const imageUrl = Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : void 0;
        const currentPrice = Number(data.current_price ?? data.currentBid ?? 0);
        const userIdsToNotify = /* @__PURE__ */ new Set();
        let privateData = {};
        try {
          const privSnap = await adminDb.collection("auctions_private").doc(auctionId).get();
          if (isDocSnapshotExists(privSnap)) {
            privateData = getDocSnapshotData(privSnap) || {};
          }
        } catch (privErr) {
        }
        const bidderIds = privateData.bidder_ids || [];
        for (const uId of bidderIds) {
          if (uId && uId !== data.seller_id && uId !== data.sellerId) {
            userIdsToNotify.add(uId);
          }
        }
        const topBids = privateData.top_bids || data.top_bids || [];
        for (const item of topBids) {
          const uId = item.user_id || item.userId;
          if (uId && uId !== data.seller_id && uId !== data.sellerId) {
            userIdsToNotify.add(uId);
          }
        }
        let sentCount = 0;
        for (const userId of userIdsToNotify) {
          try {
            const userSnap = await adminDb.collection("users").doc(userId).get();
            if (isDocSnapshotExists(userSnap)) {
              const udata = getDocSnapshotData(userSnap) || {};
              if (udata.email) {
                const minutesLeft = Math.max(1, Math.round(diffMs / 6e4));
                await sendEndingSoonNotification({
                  toEmail: udata.email,
                  recipientName: udata.first_name || udata.name || "Uporabnik",
                  auctionId,
                  auctionTitle: title,
                  auctionImageUrl: imageUrl,
                  currentPrice,
                  endTimeFormatted: `${minutesLeft} min`
                });
                sentCount++;
              }
            }
          } catch (userErr) {
          }
        }
        try {
          await adminDb.collection("auctions").doc(auctionId).update({
            reminder_30m_sent: true,
            reminder_30m_sent_at: nowIso
          });
        } catch (updErr) {
        }
        result.actions.reminders30mSent += sentCount;
        details.push(`30m reminder sent for auction ${auctionId} to ${sentCount} users`);
      }
    }
    let endedAuctionsSnap;
    try {
      endedAuctionsSnap = await adminDb.collection("auctions").where("status", "==", "active").where("end_time", "<=", nowIso).limit(100).get();
    } catch (e) {
      console.warn("[CRON] Failed to fetch ended auctions:", e.message);
      endedAuctionsSnap = { empty: true, docs: [] };
    }
    for (const auctionDoc of endedAuctionsSnap.docs) {
      const auctionId = auctionDoc.id;
      const res = await finalizeAuction(auctionId);
      if (res.finalized) {
        if (res.post_auction_status === "awaiting_payment_1st") {
          result.actions.auctionsEnded++;
          result.actions.winnersNotified++;
          details.push(`Auction ${auctionId} finalized; awaiting_payment_1st`);
        } else if (res.post_auction_status === "unsold") {
          result.actions.unsoldUpdated++;
          details.push(`Auction ${auctionId} finalized; marked as unsold`);
        }
      }
    }
    let awaitingPaymentSnap;
    const plus2HoursIso = new Date(now.getTime() + 2 * 60 * 60 * 1e3).toISOString();
    try {
      awaitingPaymentSnap = await adminDb.collection("auctions").where("post_auction_status", "==", "awaiting_payment_1st").where("payment_deadline", "<=", plus2HoursIso).limit(100).get();
    } catch (e) {
      console.warn("[CRON] Failed to fetch awaiting payment auctions:", e.message);
      awaitingPaymentSnap = { empty: true, docs: [] };
    }
    for (const auctionDoc of awaitingPaymentSnap.docs) {
      const data = auctionDoc.data();
      if (data.payment_status === "paid" || data.payment_reminder_sent) continue;
      const deadlineStr = data.payment_deadline;
      if (!deadlineStr) continue;
      const deadline = new Date(deadlineStr).getTime();
      const diffMs = deadline - now.getTime();
      if (diffMs > 0 && diffMs <= 2 * 60 * 60 * 1e3) {
        const auctionId = auctionDoc.id;
        const winnerId = data.winner_id || data.winnerId;
        const title = data.title?.SLO || data.title?.EN || (typeof data.title === "string" ? data.title : "Predmet dra\u017Ebe");
        const imageUrl = Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : void 0;
        const amount = Number(data.current_price ?? data.currentBid ?? 0);
        if (winnerId) {
          try {
            const winnerSnap = await adminDb.collection("users").doc(winnerId).get();
            if (isDocSnapshotExists(winnerSnap)) {
              const winnerData = getDocSnapshotData(winnerSnap) || {};
              if (winnerData.email) {
                const hoursLeft = Math.max(1, Math.round(diffMs / (60 * 60 * 1e3)));
                await sendPaymentReminderNotification({
                  toEmail: winnerData.email,
                  recipientName: winnerData.first_name || winnerData.name || "Kupec",
                  auctionId,
                  auctionTitle: title,
                  auctionImageUrl: imageUrl,
                  amount,
                  paymentDeadlineFormatted: `manj kot ${hoursLeft} ${hoursLeft === 1 ? "ura" : "uri"}`
                });
                result.actions.paymentRemindersSent++;
                details.push(`Payment reminder (2h) sent to ${winnerData.email} for auction ${auctionId}`);
              }
            }
          } catch (payErr) {
          }
        }
        await adminDb.collection("auctions").doc(auctionId).update({
          payment_reminder_sent: true,
          payment_reminder_sent_at: nowIso
        });
      }
    }
    let expiredPaymentSnap;
    try {
      expiredPaymentSnap = await adminDb.collection("auctions").where("post_auction_status", "==", "awaiting_payment_1st").where("payment_deadline", "<=", nowIso).limit(100).get();
    } catch (e) {
      console.warn("[CRON] Failed to fetch expired payment auctions:", e.message);
      expiredPaymentSnap = { empty: true, docs: [] };
    }
    for (const auctionDoc of expiredPaymentSnap.docs) {
      const data = auctionDoc.data();
      if (data.payment_status === "paid") continue;
      const deadlineStr = data.payment_deadline;
      if (!deadlineStr) continue;
      const deadline = new Date(deadlineStr).getTime();
      if (deadline <= now.getTime()) {
        const auctionId = auctionDoc.id;
        const winnerId = data.winner_id || data.winnerId;
        if (winnerId) {
          try {
            const userRef = adminDb.collection("users").doc(winnerId);
            const auctionRef = adminDb.collection("auctions").doc(auctionId);
            await adminDb.runTransaction(async (transaction) => {
              const auctionSnap = await transaction.get(auctionRef);
              if (!auctionSnap.exists) return;
              const auctionData = auctionSnap.data() || {};
              if (auctionData.unpaid_strike_applied === true) {
                return;
              }
              const userSnap = await transaction.get(userRef);
              const userData = userSnap.exists ? userSnap.data() || {} : {};
              const currentStrikes = Number(userData.unpaidStrikes ?? userData.unpaid_penalties ?? userData.unpaidPenalties ?? 0);
              const newStrikes = currentStrikes + 1;
              const userUpdates = {
                unpaidStrikes: import_firestore.FieldValue.increment(1),
                unpaid_penalties: import_firestore.FieldValue.increment(1)
              };
              if (newStrikes >= 3) {
                userUpdates.isBlocked = true;
              }
              transaction.update(userRef, userUpdates);
              transaction.update(auctionRef, { unpaid_strike_applied: true });
            });
            await syncPublicProfile(winnerId);
          } catch (strikeErr) {
          }
        }
        let privTopBids = [];
        try {
          const privSnap = await adminDb.collection("auctions_private").doc(auctionId).get();
          if (isDocSnapshotExists(privSnap)) {
            const privData = getDocSnapshotData(privSnap) || {};
            privTopBids = privData.top_bids || [];
          }
        } catch (privErr) {
        }
        const topBids = privTopBids.length > 0 ? privTopBids : data.top_bids || [];
        const secondBidder = topBids.length > 1 ? topBids[1] : null;
        if (secondBidder && secondBidder.user_id) {
          const secondChanceDeadline = new Date(now.getTime() + 48 * 60 * 60 * 1e3).toISOString();
          await adminDb.collection("auctions").doc(auctionId).update({
            post_auction_status: "offered_2nd",
            second_chance_deadline: secondChanceDeadline,
            second_winner_id: secondBidder.user_id
          });
          details.push(`Auction ${auctionId} 1st payment expired; offered 2nd chance to ${secondBidder.user_id}`);
        } else {
          await adminDb.collection("auctions").doc(auctionId).update({
            post_auction_status: "failed_1st"
          });
          details.push(`Auction ${auctionId} 1st payment expired with no 2nd bidder; marked failed_1st`);
        }
        result.actions.expired1stProcessed++;
      }
    }
    const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1e3).toISOString();
    let completedAuctionsSnap;
    try {
      completedAuctionsSnap = await adminDb.collection("auctions").where("status", "==", "completed").where("end_time", "<=", thirtyDaysAgoIso).limit(100).get();
    } catch (e) {
      completedAuctionsSnap = { empty: true, docs: [] };
    }
    for (const auctionDoc of completedAuctionsSnap.docs) {
      const data = auctionDoc.data();
      if (data.post_auction_status === "unsold" || data.post_auction_status === "failed_1st" || data.post_auction_status === "failed_2nd" || data.post_auction_status === "rejected_2nd") {
        const auctionId = auctionDoc.id;
        try {
          await adminDb.collection("auctions").doc(auctionId).delete();
          details.push(`Auction ${auctionId} permanently deleted from DB (expired > 30 days)`);
        } catch (delErr) {
        }
      }
    }
    try {
      const receivedAuctionsSnap = await adminDb.collection("auctions").where("buyer_received", "==", true).limit(100).get();
      const twentyFourHoursMs = 24 * 60 * 60 * 1e3;
      for (const aDoc of receivedAuctionsSnap.docs) {
        const aData = aDoc.data();
        if (aData.review_submitted || aData.review_reminder_sent) continue;
        const receivedAtStr = aData.received_at || aData.receipt_confirmed_at || aData.paid_at;
        if (!receivedAtStr) continue;
        const receivedTime = new Date(receivedAtStr).getTime();
        if (now.getTime() - receivedTime >= twentyFourHoursMs) {
          const buyerId = aData.winner_id || aData.winnerId;
          if (buyerId) {
            try {
              const buyerSnap = await adminDb.collection("users").doc(buyerId).get();
              if (isDocSnapshotExists(buyerSnap)) {
                const bData = getDocSnapshotData(buyerSnap) || {};
                if (bData.email) {
                  const aTitle = aData.title?.SLO || aData.title?.EN || (typeof aData.title === "string" ? aData.title : "Predmet dra\u017Ebe");
                  const aImage = Array.isArray(aData.images) && aData.images.length > 0 ? aData.images[0] : void 0;
                  await sendReviewReminderNotification({
                    toEmail: bData.email,
                    recipientName: bData.first_name || bData.name || "Spo\u0161tovani kupec",
                    auctionId: aDoc.id,
                    auctionTitle: aTitle,
                    auctionImageUrl: aImage
                  });
                  await aDoc.ref.update({
                    review_reminder_sent: true,
                    review_reminder_sent_at: nowIso
                  });
                  result.actions.reviewRemindersSent++;
                  details.push(`Review reminder sent for auction ${aDoc.id} to buyer ${bData.email}`);
                }
              }
            } catch (remErr) {
            }
          }
        }
      }
    } catch (revCronErr) {
    }
    try {
      const cancelledUsersSnap = await adminDb.collection("users").where("subscription_canceled", "==", true).limit(100).get();
      for (const uDoc of cancelledUsersSnap.docs) {
        const uData = uDoc.data();
        if (uData.subscription_valid_until) {
          const validUntil = new Date(uData.subscription_valid_until).getTime();
          if (now.getTime() >= validUntil) {
            await uDoc.ref.set({
              subscription: "FREE",
              subscription_tier: "FREE",
              subscription_active: false,
              subscription_canceled: false
            }, { merge: true });
            details.push(`User ${uDoc.id} subscription expired after cancellation, reverted to FREE`);
          }
        }
      }
    } catch (subErr) {
    }
    return result;
  } catch (error) {
    console.error("[CRON ERROR] processAuctionCrons failed:", error);
    result.success = false;
    details.push(`Fatal error: ${error.message}`);
    return result;
  }
}

// src/lib/pdfGenerator.ts
var import_pdfkit = __toESM(require("pdfkit"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var cachedRegularFont = null;
var cachedBoldFont = null;
function loadFontBuffer(filename) {
  const searchPaths = [
    import_path.default.join(process.cwd(), "public", "fonts", filename),
    import_path.default.join(process.cwd(), "dist", "fonts", filename),
    import_path.default.join(__dirname, "..", "..", "public", "fonts", filename),
    import_path.default.join(__dirname, "..", "public", "fonts", filename),
    import_path.default.join(__dirname, "public", "fonts", filename),
    import_path.default.join(__dirname, "fonts", filename),
    import_path.default.resolve("public", "fonts", filename),
    import_path.default.resolve("dist", "fonts", filename),
    import_path.default.resolve("/app/applet/public/fonts", filename)
  ];
  for (const p of searchPaths) {
    try {
      if (import_fs.default.existsSync(p)) {
        const buf = import_fs.default.readFileSync(p);
        if (buf && buf.length > 1e3) {
          return buf;
        }
      }
    } catch {
    }
  }
  return null;
}
function getRegularFont() {
  if (!cachedRegularFont) {
    cachedRegularFont = loadFontBuffer("Roboto-Regular.ttf");
  }
  return cachedRegularFont;
}
function getBoldFont() {
  if (!cachedBoldFont) {
    cachedBoldFont = loadFontBuffer("Roboto-Bold.ttf");
  }
  return cachedBoldFont;
}
function formatEuro(amount) {
  const num = isNaN(amount) ? 0 : amount;
  return num.toLocaleString("sl-SI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function getSafeAddress(user) {
  if (!user) return "Naslov ni na voljo";
  if (typeof user === "string") return user;
  const street = user.street_address || user.company_street || user.companyStreet || user.address || user.street || "";
  const postal = user.postal_code || user.company_postal_code || user.companyPostalCode || user.postalCode || user.zip || "";
  const city = user.city || user.company_city || user.companyCity || user.place || "";
  if (street && postal && city) {
    return `${street}, ${postal} ${city}`;
  } else if (street && city) {
    return `${street}, ${city}`;
  } else if (street) {
    return street;
  } else if (city) {
    return city;
  }
  return user.address || "Naslov ni na voljo";
}
function getSafePlace(user) {
  if (!user) return "Maribor, Slovenija";
  let raw = user.company_city || user.companyCity || user.city || user.place || "";
  if (!raw && user.address) {
    const parts = user.address.split(",");
    if (parts.length > 1) {
      raw = parts[parts.length - 1].trim();
      if (raw.toLowerCase() === "slovenija" && parts.length > 2) {
        raw = parts[parts.length - 2].trim();
      }
    } else {
      raw = user.address;
    }
  }
  let cleaned = (raw || "Maribor").replace(/SI-?\s*\d{4}/gi, "").replace(/\b\d{4}\b/g, "").trim().replace(/^,\s*|,\s*$/g, "");
  if (!cleaned) cleaned = "Maribor";
  if (!cleaned.toLowerCase().includes("slovenija")) {
    cleaned = `${cleaned}, Slovenija`;
  }
  return cleaned;
}
async function generateInvoicePDF(transaction = {}, buyer = {}, seller = {}, auction = {}, salesInvoiceNo, commissionInvoiceNo) {
  return new Promise((resolve, reject) => {
    const doc = new import_pdfkit.default({ margin: 40, size: "A4" });
    const buffers = [];
    const regBuf = getRegularFont();
    const boldBuf = getBoldFont();
    const hasCustomFonts = Boolean(regBuf && boldBuf);
    if (hasCustomFonts) {
      doc.registerFont("Roboto", regBuf);
      doc.registerFont("Roboto-Bold", boldBuf);
      doc.font("Roboto");
    }
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on("error", (err) => reject(err));
    const activeBuyer = transaction.buyer_snapshot || buyer || {};
    const activeSeller = transaction.seller_snapshot || seller || {};
    const sType = activeSeller.user_type || activeSeller.userType || "individual";
    const isSellerBusiness = sType === "business";
    const sellerVatStatus = activeSeller.vat_status || activeSeller.vatStatus || (isSellerBusiness ? "exempt_small" : "private");
    const bType = activeBuyer.user_type || activeBuyer.userType || "individual";
    const isBuyerBusiness = bType === "business";
    let relationship = "C2C";
    if (isSellerBusiness && isBuyerBusiness) relationship = "B2B";
    else if (isSellerBusiness && !isBuyerBusiness) relationship = "B2C";
    else if (!isSellerBusiness && isBuyerBusiness) relationship = "C2B";
    const getSafeAddressLoc = (u) => {
      if (!u) return "Naslov ni na voljo";
      if (typeof u === "string") return u;
      const street = u.street_address || u.street || u.company_street || u.companyStreet || u.address || "";
      const postal = u.postal_code || u.postalCode || u.company_postal_code || u.companyPostalCode || u.zip || "";
      const city = u.city || u.company_city || u.companyCity || u.place || "";
      if (street && postal && city) return `${street}, ${postal} ${city}`;
      if (street && city) return `${street}, ${city}`;
      if (street) return street;
      if (city) return city;
      return u.address || "Naslov ni na voljo";
    };
    const checkRequiredFields = () => {
      const missing = [];
      const isEmpty = (v) => !v || String(v).trim().length === 0;
      if (relationship === "C2C" || relationship === "C2B") {
        const sName = `${activeSeller.first_name || activeSeller.firstName || ""} ${activeSeller.last_name || activeSeller.lastName || ""}`.trim() || activeSeller.name || "";
        if (isEmpty(sName)) missing.push("seller.name");
        const sAddress = getSafeAddressLoc(activeSeller);
        if (isEmpty(sAddress) || sAddress === "Naslov ni na voljo") missing.push("seller.address");
        const sPostal = activeSeller.postal_code || activeSeller.postalCode || "";
        if (isEmpty(sPostal)) missing.push("seller.postal_code");
        const sCity = activeSeller.city || "";
        if (isEmpty(sCity)) missing.push("seller.city");
        const sCountry = activeSeller.country_code || activeSeller.countryCode || activeSeller.country || "";
        if (isEmpty(sCountry)) missing.push("seller.country_code");
      } else {
        const sCompName = activeSeller.company_name || activeSeller.companyName || "";
        if (isEmpty(sCompName)) missing.push("seller.company_name");
        const sAddress = getSafeAddressLoc(activeSeller);
        if (isEmpty(sAddress) || sAddress === "Naslov ni na voljo") missing.push("seller.address");
        const sPostal = activeSeller.postal_code || activeSeller.postalCode || activeSeller.company_postal_code || activeSeller.companyPostalCode || "";
        if (isEmpty(sPostal)) missing.push("seller.postal_code");
        const sCity = activeSeller.city || activeSeller.company_city || activeSeller.companyCity || "";
        if (isEmpty(sCity)) missing.push("seller.city");
        const sCountry = activeSeller.country_code || activeSeller.countryCode || activeSeller.country || "";
        if (isEmpty(sCountry)) missing.push("seller.country_code");
        const sReg = activeSeller.registration_number || activeSeller.regNumber || activeSeller.registrationNumber || "";
        if (isEmpty(sReg)) missing.push("seller.registration_number");
        const sTax = activeSeller.tax_id || activeSeller.taxId || activeSeller.tax_number || activeSeller.taxNumber || "";
        if (isEmpty(sTax)) missing.push("seller.tax_id");
        if (sellerVatStatus === "payer") {
          const sVat = activeSeller.vat_id || activeSeller.vatId || "";
          if (isEmpty(sVat)) missing.push("seller.vat_id");
        }
      }
      if (relationship === "C2C" || relationship === "B2C") {
        const bName = `${activeBuyer.first_name || activeBuyer.firstName || ""} ${activeBuyer.last_name || activeBuyer.lastName || ""}`.trim() || activeBuyer.name || "";
        if (isEmpty(bName)) missing.push("buyer.name");
        const bAddress = getSafeAddressLoc(activeBuyer);
        if (isEmpty(bAddress) || bAddress === "Naslov ni na voljo") missing.push("buyer.address");
        const bPostal = activeBuyer.postal_code || activeBuyer.postalCode || "";
        if (isEmpty(bPostal)) missing.push("buyer.postal_code");
        const bCity = activeBuyer.city || "";
        if (isEmpty(bCity)) missing.push("buyer.city");
        const bCountry = activeBuyer.country_code || activeBuyer.countryCode || activeBuyer.country || "";
        if (isEmpty(bCountry)) missing.push("buyer.country_code");
      } else {
        const bCompName = activeBuyer.company_name || activeBuyer.companyName || "";
        if (isEmpty(bCompName)) missing.push("buyer.company_name");
        const bAddress = getSafeAddressLoc(activeBuyer);
        if (isEmpty(bAddress) || bAddress === "Naslov ni na voljo") missing.push("buyer.address");
        const bPostal = activeBuyer.postal_code || activeBuyer.postalCode || activeBuyer.company_postal_code || activeBuyer.companyPostalCode || "";
        if (isEmpty(bPostal)) missing.push("buyer.postal_code");
        const bCity = activeBuyer.city || activeBuyer.company_city || activeBuyer.companyCity || "";
        if (isEmpty(bCity)) missing.push("buyer.city");
        const bCountry = activeBuyer.country_code || activeBuyer.countryCode || activeBuyer.country || "";
        if (isEmpty(bCountry)) missing.push("buyer.country_code");
        const bTax = activeBuyer.tax_id || activeBuyer.taxId || activeBuyer.tax_number || activeBuyer.taxNumber || "";
        if (isEmpty(bTax)) missing.push("buyer.tax_id");
        const bReg = activeBuyer.registration_number || activeBuyer.regNumber || activeBuyer.registrationNumber || "";
        if (isEmpty(bReg)) missing.push("buyer.registration_number");
      }
      return missing;
    };
    const missingFields = checkRequiredFields();
    if (missingFields.length > 0) {
      reject(new Error(`MISSING_REQUIRED_INVOICE_FIELDS: ${missingFields.join(", ")}`));
      return;
    }
    const docNo = salesInvoiceNo || `INV-${(transaction.id || auction.id || "000000").substring(0, 8).toUpperCase()}`;
    const todayStr = (/* @__PURE__ */ new Date()).toLocaleDateString("sl-SI");
    const paymentDate = auction.paid_at ? new Date(auction.paid_at).toLocaleDateString("sl-SI") : todayStr;
    const sellerName = isSellerBusiness ? activeSeller.company_name || activeSeller.companyName || "Prodajalec d.o.o." : `${activeSeller.first_name || activeSeller.firstName || ""} ${activeSeller.last_name || activeSeller.lastName || ""}`.trim() || "Prodajalec";
    const buyerName = isBuyerBusiness ? activeBuyer.company_name || activeBuyer.companyName || "Kupec d.o.o." : `${activeBuyer.first_name || activeBuyer.firstName || ""} ${activeBuyer.last_name || activeBuyer.lastName || ""}`.trim() || "Kupec";
    const sellerAddress = getSafeAddressLoc(activeSeller);
    const buyerAddress = getSafeAddressLoc(activeBuyer);
    const sellerPlace = getSafePlace(activeSeller);
    const sellerTaxId = activeSeller.tax_id || activeSeller.taxId || activeSeller.vat_id || activeSeller.vatId || "";
    const sellerRegNo = activeSeller.registration_number || activeSeller.regNumber || activeSeller.registrationNumber || "";
    const buyerTaxId = activeBuyer.tax_id || activeBuyer.taxId || activeBuyer.vat_id || activeBuyer.vatId || "";
    const buyerRegNo = activeBuyer.registration_number || activeBuyer.regNumber || activeBuyer.registrationNumber || "";
    const itemPrice = Number(transaction.item_price ?? (transaction.item_amount ?? (transaction.item_cents ? transaction.item_cents / 100 : auction.currentBid || auction.current_price || 0)));
    let vatRate = 0;
    let vatAmount = 0;
    let vatBase = itemPrice;
    let isVatApplicable = false;
    let noteText = "";
    let isReverseCharge = false;
    const buyerCountry = (activeBuyer.country_code || activeBuyer.countryCode || activeBuyer.country || "SI").trim().toUpperCase();
    if (relationship === "C2C" || relationship === "C2B") {
      vatRate = 0;
      vatAmount = 0;
      vatBase = itemPrice;
      isVatApplicable = false;
      noteText = "DDV ni obra\u010Dunan (prodajalec je fizi\u010Dna oseba).";
    } else {
      if (sellerVatStatus === "payer") {
        isVatApplicable = true;
        if (relationship === "B2B" && buyerCountry !== "SI" && ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "ES", "SE"].includes(buyerCountry) && buyerTaxId) {
          isReverseCharge = true;
          vatRate = 0;
          vatAmount = 0;
          vatBase = itemPrice;
          noteText = "Obrnjena dav\u010Dna obveznost / Reverse charge po Direktivi Sveta 2006/112/ES in 76. a \u010Dlenu ZDDV-1.";
        } else {
          vatRate = 22;
          vatBase = Math.round(itemPrice / 1.22 * 100) / 100;
          vatAmount = Math.round((itemPrice - vatBase) * 100) / 100;
          noteText = "V ceno je vklju\u010Den 22% DDV v skladu z Zakonom o davku na dodano vrednost (ZDDV-1).";
        }
      } else {
        vatRate = 0;
        vatAmount = 0;
        vatBase = itemPrice;
        isVatApplicable = false;
        noteText = "DDV ni obra\u010Dunan na podlagi 1. odstavka 94. \u010Dlena ZDDV-1 (mali dav\u010Dni zavezanec).";
      }
    }
    const itemTitle = (typeof auction.title === "object" ? auction.title?.SLO || auction.title?.EN : auction.title) || "Dra\u017Ebeni predmet";
    const auctionId = auction.id || transaction.auction_id || "ni podatka";
    const deliveryMethod = auction.delivery_method === "post" ? "Dostava po po\u0161ti" : auction.delivery_method === "pickup" ? "Osebni prevzem na lokaciji prodajalca" : "Osebni prevzem ali po dogovoru";
    const colorDark = "#0A1128";
    const colorMuted = "#64748B";
    const colorLight = "#94A3B8";
    const colorBorder = "#E2E8F0";
    const setBold = () => {
      if (hasCustomFonts) doc.font("Roboto-Bold");
      else doc.font("Helvetica-Bold");
    };
    const setRegular = () => {
      if (hasCustomFonts) doc.font("Roboto");
      else doc.font("Helvetica");
    };
    setBold();
    const docTitle = relationship === "C2C" ? "POTRDILO O NAKUPU (C2C)" : relationship === "C2B" ? "KUPOPRODAJNA POGODBA" : "RA\u010CUN / INVOICE";
    doc.fontSize(20).fillColor(colorDark).text(docTitle, 40, 42);
    setBold();
    doc.fontSize(18).fillColor(colorLight).text("dra\u017Ebenik.si", 360, 42, { width: 195, align: "right" });
    setRegular();
    doc.fontSize(8.5).fillColor(colorLight).text("Platforma za posredovanje", 360, 65, { width: 195, align: "right" });
    let yPos = 72;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted);
    setRegular();
    doc.fillColor(colorMuted).text("\u0160tevilka dokumenta: ", 40, yPos, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(docNo);
    yPos += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Kraj izdaje: ", 40, yPos, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(sellerPlace);
    yPos += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Datum izdaje / sklenitve: ", 40, yPos, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(paymentDate);
    yPos += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Datum opravljene storitve/dobave: ", 40, yPos, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(paymentDate);
    yPos += 20;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, yPos).lineTo(555, yPos).stroke();
    yPos += 14;
    const colLeft = 40;
    const colRight = 310;
    setBold();
    doc.fontSize(7.5).fillColor(colorLight).text("IZDAJATELJ (PRODAJALEC)", colLeft, yPos);
    doc.text("PREJEMNIK (KUPEC)", colRight, yPos);
    yPos += 13;
    setBold();
    doc.fontSize(10.5).fillColor(colorDark).text(sellerName, colLeft, yPos, { width: 240 });
    doc.text(buyerName, colRight, yPos, { width: 240 });
    yPos += 15;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted).text(sellerAddress, colLeft, yPos, { width: 240 });
    doc.text(buyerAddress, colRight, yPos, { width: 240 });
    yPos += 13;
    doc.text(`Dav\u010Dna \u0161tevilka: ${sellerTaxId ? sellerTaxId : "Ni navedena"}`, colLeft, yPos);
    doc.text(`Dav\u010Dna \u0161tevilka: ${buyerTaxId ? buyerTaxId : "Ni navedena"}`, colRight, yPos);
    if (sellerRegNo || buyerRegNo) {
      yPos += 12;
      if (sellerRegNo) doc.text(`Mati\u010Dna \u0161tevilka: ${sellerRegNo}`, colLeft, yPos);
      if (buyerRegNo) doc.text(`Mati\u010Dna \u0161tevilka: ${buyerRegNo}`, colRight, yPos);
    }
    yPos += 18;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, yPos).lineTo(555, yPos).stroke();
    yPos += 12;
    doc.roundedRect(40, yPos, 515, 24, 4).fillAndStroke("#F8FAFC", "#E2E8F0");
    const badgeCenterX = 53;
    const badgeCenterY = yPos + 12;
    doc.circle(badgeCenterX, badgeCenterY, 5.5).fillColor("#2563EB").fill();
    setBold();
    doc.fontSize(7).fillColor("#FFFFFF").text("i", badgeCenterX - 1.8, badgeCenterY - 4, { lineBreak: false });
    setBold();
    doc.fontSize(8).fillColor(colorDark).text("Identifikacija: ", 66, yPos + 7, { continued: true });
    setRegular();
    doc.fillColor(colorMuted).text("Stranki sta elektronsko identificirani znotraj platforme dra\u017Ebenik.si.");
    yPos += 38;
    setBold();
    doc.fontSize(8).fillColor(colorDark);
    doc.text("OPIS", 40, yPos);
    doc.text("KOLI\u010CINA", 260, yPos, { width: 70, align: "center" });
    doc.text("CENA (\u20AC)", 355, yPos, { width: 85, align: "right" });
    doc.text("SKUPAJ (\u20AC)", 455, yPos, { width: 100, align: "right" });
    yPos += 13;
    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(40, yPos).lineTo(555, yPos).stroke();
    yPos += 10;
    setBold();
    doc.fontSize(9.5).fillColor(colorDark).text(itemTitle, 40, yPos, { width: 220 });
    setRegular();
    doc.fontSize(9).text("1", 260, yPos, { width: 70, align: "center" });
    doc.text(formatEuro(itemPrice), 355, yPos, { width: 85, align: "right" });
    setBold();
    doc.text(formatEuro(itemPrice), 455, yPos, { width: 100, align: "right" });
    yPos += 13;
    setRegular();
    doc.fontSize(7.5).fillColor(colorLight).text(`ID dra\u017Ebe: ${auctionId}`, 40, yPos);
    yPos += 15;
    doc.roundedRect(40, yPos, 515, 18, 3).fill("#F8FAFC");
    doc.fontSize(8).fillColor(colorMuted).text(`Na\u010Din predaje: ${deliveryMethod}`, 50, yPos + 5);
    yPos += 24;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, yPos).lineTo(555, yPos).stroke();
    yPos += 14;
    const totalsLeft = 325;
    const totalsValueRight = 555;
    if (isVatApplicable) {
      setRegular();
      doc.fontSize(8.5).fillColor(colorMuted).text("Osnova za DDV (22%):", totalsLeft, yPos);
      setBold();
      doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(vatBase)} \u20AC`, totalsLeft + 120, yPos, { width: 110, align: "right" });
      yPos += 15;
      setRegular();
      doc.fontSize(8.5).fillColor(colorMuted).text("Znesek DDV (22%):", totalsLeft, yPos);
      setBold();
      doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(vatAmount)} \u20AC`, totalsLeft + 120, yPos, { width: 110, align: "right" });
      yPos += 15;
    } else {
      setRegular();
      doc.fontSize(8.5).fillColor(colorMuted).text("Kupnina / Znesek:", totalsLeft, yPos);
      setBold();
      doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(itemPrice)} \u20AC`, totalsLeft + 120, yPos, { width: 110, align: "right" });
      yPos += 15;
      setRegular();
      doc.fontSize(8.5).fillColor(colorMuted).text("DDV:", totalsLeft, yPos);
      setBold();
      doc.fontSize(8.5).fillColor(colorDark).text("Ni obra\u010Dunan", totalsLeft + 120, yPos, { width: 110, align: "right" });
      yPos += 15;
    }
    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(totalsLeft, yPos).lineTo(totalsValueRight, yPos).stroke();
    yPos += 7;
    setBold();
    doc.fontSize(10).fillColor(colorDark).text("SKUPAJ ZA PLA\u010CILO:", totalsLeft, yPos);
    doc.fontSize(10.5).text(`${formatEuro(itemPrice)} \u20AC`, totalsLeft + 120, yPos, { width: 110, align: "right" });
    const footerY = 665;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, footerY).lineTo(555, footerY).stroke();
    let footY = footerY + 11;
    setBold();
    doc.fontSize(7.5).fillColor(colorDark).text("Jamstvo za neskladnost blaga (ZVPot-1): ", 40, footY, { continued: true });
    setRegular();
    doc.fillColor(colorMuted).text("Za blago veljajo zakonska jamstva za neskladnost blaga v skladu z ZVPot-1.");
    footY += 13;
    setBold();
    doc.fontSize(7.5).fillColor(colorDark).text("Prenos lastni\u0161tva: ", 40, footY, { continued: true });
    setRegular();
    doc.fillColor(colorMuted).text("Lastninska pravica in nevarnost naklju\u010Dnega uni\u010Denja preideta na kupca ob celotnem pla\u010Dilu kupnine in prevzemu predmeta.");
    footY += 13;
    setBold();
    doc.fontSize(7.5).fillColor(colorDark).text("Pravna opomba in DDV: ", 40, footY, { continued: true });
    setRegular();
    doc.fillColor(colorMuted).text(noteText);
    footY += 15;
    setRegular();
    doc.fontSize(7).fillColor(colorLight).text(
      "Platforma dra\u017Ebenik.si nastopa izklju\u010Dno kot tehnolo\u0161ki posrednik in ni stranka v prodajni pogodbi. Ta dokument slu\u017Ei kot kupoprodajna pogodba in potrdilo o sklenjenem poslu ter pla\u010Dilu med prodajalcem in kupcem, generirano samodejno s strani sistema po uspe\u0161nem zaklju\u010Dku dra\u017Ebe.",
      40,
      footY,
      { width: 515 }
    );
    doc.addPage({ margin: 40, size: "A4" });
    const feeDocNo = commissionInvoiceNo || `PROV-${(transaction.id || auction.id || "000000").substring(0, 8).toUpperCase()}`;
    const feeBase = Number(transaction.platform_fee ?? itemPrice * 0.1 / 1.22);
    const feeVatRate = transaction.vat_rate !== void 0 ? Number(transaction.vat_rate) : 22;
    const feeVat = Number(transaction.vat_amount ?? feeBase * (feeVatRate / 100));
    isReverseCharge = Boolean(transaction.is_reverse_charge);
    const feeTotal = feeBase + feeVat;
    setBold();
    doc.fontSize(16).fillColor(colorDark).text("RA\u010CUN ZA STORITEV / SERVICE INVOICE", 40, 42, { width: 515, align: "center" });
    let p2Y = 75;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, p2Y).lineTo(555, p2Y).stroke();
    p2Y += 13;
    setBold();
    doc.fontSize(7.5).fillColor(colorLight).text("IZDAJATELJ (PLATFORMA)", colLeft, p2Y);
    doc.text("PREJEMNIK STORITVE (KUPEC)", colRight, p2Y);
    p2Y += 13;
    setBold();
    doc.fontSize(10.5).fillColor(colorDark).text("Dizain d.o.o.", colLeft, p2Y, { width: 240 });
    doc.text(buyerName, colRight, p2Y, { width: 240 });
    p2Y += 15;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted).text("Karantanska ulica 28, 2000 Maribor", colLeft, p2Y, { width: 240 });
    doc.text(buyerAddress, colRight, p2Y, { width: 240 });
    p2Y += 13;
    doc.text("Dav\u010Dna \u0161tevilka: SI57008060", colLeft, p2Y);
    doc.text(`Dav\u010Dna \u0161tevilka: ${buyerTaxId ? buyerTaxId : "Ni navedena"}`, colRight, p2Y);
    p2Y += 12;
    doc.text("Mati\u010Dna \u0161tevilka: 9093494000", colLeft, p2Y);
    if (buyerRegNo) {
      doc.text(`Mati\u010Dna \u0161tevilka: ${buyerRegNo}`, colRight, p2Y);
    }
    p2Y += 18;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, p2Y).lineTo(555, p2Y).stroke();
    p2Y += 14;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted).text("\u0160tevilka ra\u010Duna: ", colLeft, p2Y, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(feeDocNo);
    p2Y += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Datum izdaje in opravljene storitve: ", colLeft, p2Y, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(paymentDate);
    p2Y += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Na\u010Din pla\u010Dila: ", colLeft, p2Y, { continued: true });
    setBold();
    doc.fillColor(colorDark).text("Spletno pla\u010Dilo / Kartica");
    p2Y += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Status pla\u010Dila: ", colLeft, p2Y, { continued: true });
    setBold();
    doc.fillColor("#059669").text(`PLA\u010CANO (${paymentDate})`);
    p2Y += 28;
    setBold();
    doc.fontSize(8).fillColor(colorDark);
    doc.text("OPIS", 40, p2Y);
    doc.text("OSNOVA (\u20AC)", 455, p2Y, { width: 100, align: "right" });
    p2Y += 13;
    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(40, p2Y).lineTo(555, p2Y).stroke();
    p2Y += 10;
    setBold();
    doc.fontSize(9.5).fillColor(colorDark).text("Provizija platforme za uporabo sistema", 40, p2Y, { width: 350 });
    setRegular();
    doc.fontSize(9).text(formatEuro(feeBase), 455, p2Y, { width: 100, align: "right" });
    yPos += 13;
    setRegular();
    doc.fontSize(7.5).fillColor(colorLight).text(`Dra\u017Eba: ${itemTitle}`, 40, p2Y + 14);
    p2Y += 28;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, p2Y).lineTo(555, p2Y).stroke();
    p2Y += 15;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted).text("Osnova / Base:", totalsLeft, p2Y);
    setBold();
    doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(feeBase)} \u20AC`, totalsLeft + 120, p2Y, { width: 110, align: "right" });
    p2Y += 15;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted).text(`DDV / VAT (${feeVatRate}%):`, totalsLeft, p2Y);
    setBold();
    doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(feeVat)} \u20AC`, totalsLeft + 120, p2Y, { width: 110, align: "right" });
    if (isReverseCharge) {
      p2Y += 15;
      setBold();
      doc.fontSize(8).fillColor("#D97706").text("Obrnjena dav\u010Dna obveznost / Reverse charge", totalsLeft, p2Y, { width: 230 });
    }
    p2Y += 15;
    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(totalsLeft, p2Y).lineTo(totalsValueRight, p2Y).stroke();
    p2Y += 7;
    setBold();
    doc.fontSize(10).fillColor(colorDark).text("SKUPAJ PROVIZIJA:", totalsLeft, p2Y);
    doc.fontSize(10.5).text(`${formatEuro(feeTotal)} \u20AC`, totalsLeft + 120, p2Y, { width: 110, align: "right" });
    const p2FooterY = 690;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, p2FooterY).lineTo(555, p2FooterY).stroke();
    let p2FootY = p2FooterY + 12;
    setRegular();
    doc.fontSize(7.5).fillColor(colorMuted).text(
      "Dizain d.o.o. je registriran izdajatelj ra\u010Duna za posredni\u0161ke storitve platforme dra\u017Ebenik.si. V ceno storitve je vklju\u010Den 22% DDV.",
      40,
      p2FootY,
      { width: 515 }
    );
    p2FootY += 13;
    doc.fontSize(7).fillColor(colorLight).text(
      "Dokument je generiran elektronsko in je veljaven brez \u017Eiga ali podpisa v skladu z ZZEPA ter 84. \u010Dlenom Zakona o davku na dodano vrednost (ZDDV-1).",
      40,
      p2FootY,
      { width: 515 }
    );
    doc.end();
  });
}
async function generateCertificatePDF(transaction, buyer, seller) {
  return new Promise((resolve, reject) => {
    const doc = new import_pdfkit.default({ margin: 40, size: "A4" });
    const buffers = [];
    const regBuf = getRegularFont();
    const boldBuf = getBoldFont();
    const hasCustomFonts = Boolean(regBuf && boldBuf);
    if (hasCustomFonts) {
      doc.registerFont("Roboto", regBuf);
      doc.registerFont("Roboto-Bold", boldBuf);
      doc.font("Roboto");
    }
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on("error", (err) => reject(err));
    const setBold = () => {
      if (hasCustomFonts) doc.font("Roboto-Bold");
      else doc.font("Helvetica-Bold");
    };
    const setRegular = () => {
      if (hasCustomFonts) doc.font("Roboto");
      else doc.font("Helvetica");
    };
    setBold();
    doc.fontSize(18).fillColor("#0A1128").text("POTRDILO O NAKUPU / PURCHASE CERTIFICATE", { align: "center" });
    setRegular();
    doc.moveDown();
    doc.fontSize(10).fillColor("#94A3B8").text("dra\u017Ebenik.si", { align: "center" });
    doc.moveDown();
    setRegular();
    doc.fontSize(9).fillColor("#475569");
    doc.text(`\u0160tevilka potrdila / Certificate No: CERT-${(transaction.id || "").substring(0, 8).toUpperCase()}`);
    doc.text(`Datum / Date: ${(/* @__PURE__ */ new Date()).toLocaleDateString("sl-SI")}`);
    doc.moveDown();
    setBold();
    doc.fontSize(11).fillColor("#0A1128").text("Kupec / Buyer:");
    setRegular();
    doc.fontSize(9.5).fillColor("#475569").text(`${buyer.first_name || ""} ${buyer.last_name || ""}`.trim() || buyer.name || "Kupec");
    doc.moveDown();
    setBold();
    doc.fontSize(11).fillColor("#0A1128").text("Prodajalec / Seller:");
    setRegular();
    doc.fontSize(9.5).fillColor("#475569").text(`${seller.first_name || ""} ${seller.last_name || ""}`.trim() || seller.name || "Prodajalec");
    if (seller.company_status === "company") {
      doc.text(`Podjetje / Company: ${seller.company_name || "N/A"}`);
    }
    doc.moveDown();
    const amount = Number(transaction.amount_total || 0);
    setBold();
    doc.fontSize(11).fillColor("#0A1128").text("Podrobnosti transakcije / Transaction Details:");
    setRegular();
    doc.fontSize(9.5).fillColor("#475569").text(`Znesek nakupa / Purchase Amount: \u20AC${amount.toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(8.5).fillColor("#94A3B8").text("To potrdilo slu\u017Ei kot informativni dokaz o uspe\u0161no zaklju\u010Deni dra\u017Ebi in pla\u010Dilu.");
    doc.end();
  });
}
async function generateSubscriptionInvoicePDF(params) {
  return new Promise((resolve, reject) => {
    const doc = new import_pdfkit.default({ margin: 40, size: "A4" });
    const buffers = [];
    const regBuf = getRegularFont();
    const boldBuf = getBoldFont();
    const hasCustomFonts = Boolean(regBuf && boldBuf);
    if (hasCustomFonts) {
      doc.registerFont("Roboto", regBuf);
      doc.registerFont("Roboto-Bold", boldBuf);
      doc.font("Roboto");
    }
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });
    doc.on("error", (err) => reject(err));
    const setBold = () => {
      if (hasCustomFonts) doc.font("Roboto-Bold");
      else doc.font("Helvetica-Bold");
    };
    const setRegular = () => {
      if (hasCustomFonts) doc.font("Roboto");
      else doc.font("Helvetica");
    };
    const colorDark = "#0A1128";
    const colorMuted = "#64748B";
    const colorLight = "#94A3B8";
    const colorBorder = "#E2E8F0";
    const {
      invoiceNo,
      user = {},
      planId = "basic",
      amount = 20,
      paymentDate = (/* @__PURE__ */ new Date()).toLocaleDateString("sl-SI"),
      paymentMethod = "Spletno pla\u010Dilo / Kartica (Stripe)"
    } = params;
    const startDate = params.periodStart || /* @__PURE__ */ new Date();
    const endDate = params.periodEnd || new Date(new Date(startDate).setMonth(startDate.getMonth() + 1));
    const periodStr = `${startDate.toLocaleDateString("sl-SI")} - ${endDate.toLocaleDateString("sl-SI")}`;
    const isCompany = user.company_status === "company" || user.user_type === "business" || Boolean(user.company_name);
    const buyerName = user.company_name || `${user.first_name || user.firstName || ""} ${user.last_name || user.lastName || ""}`.trim() || user.name || user.username || user.email || "Naro\u010Dnik";
    const buyerAddress = getSafeAddress(user);
    const buyerTaxId = user.tax_id || user.taxId || user.vat_id || "";
    const buyerRegNo = user.registration_number || user.regNumber || "";
    const euCountries = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "ES", "SE"];
    const userCountry = (user.country_code || user.country || "SI").toUpperCase();
    const isReverseCharge = isCompany && buyerTaxId && euCountries.includes(userCountry) && userCountry !== "SI";
    const totalAmount = Number(amount || (planId.toLowerCase().includes("pro") ? 50 : 20));
    const vatRate = isReverseCharge ? 0 : 0.22;
    const baseAmount = isReverseCharge ? totalAmount : Math.round(totalAmount / 1.22 * 100) / 100;
    const vatAmount = isReverseCharge ? 0 : Math.round((totalAmount - baseAmount) * 100) / 100;
    const isPro = planId.toLowerCase().includes("pro");
    const planTitle = isPro ? "Mese\u010Dna naro\u010Dnina - Paket NAPREDNI" : "Mese\u010Dna naro\u010Dnina - Paket OSNOVNI";
    const planDesc = isPro ? "Aktivna naro\u010Dnina za profesionalne prodajalce: neomejeno objavljenih dra\u017Eb, zni\u017Eana 4% provizija platforme, prednostna izpostavljenost." : "Aktivna naro\u010Dnina za redne prodajalce: do 20 objavljenih dra\u017Eb mese\u010Dno, zni\u017Eana 6% provizija platforme.";
    const colLeft = 40;
    const colRight = 310;
    setBold();
    doc.fontSize(16).fillColor(colorDark).text("RA\u010CUN ZA NARO\u010CNINO / SUBSCRIPTION INVOICE", 40, 42, { width: 515, align: "center" });
    let yPos = 75;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, yPos).lineTo(555, yPos).stroke();
    yPos += 13;
    setBold();
    doc.fontSize(7.5).fillColor(colorLight).text("IZDAJATELJ (PLATFORMA)", colLeft, yPos);
    doc.text("NARO\u010CNIK / PREJEMNIK RA\u010CUNA", colRight, yPos);
    yPos += 13;
    setBold();
    doc.fontSize(10.5).fillColor(colorDark).text("Dizain d.o.o.", colLeft, yPos, { width: 240 });
    doc.text(buyerName, colRight, yPos, { width: 240 });
    yPos += 15;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted).text("Karantanska ulica 28, 2000 Maribor, Slovenija", colLeft, yPos, { width: 240 });
    doc.text(buyerAddress, colRight, yPos, { width: 240 });
    yPos += 13;
    doc.text("Dav\u010Dna \u0161tevilka: SI57008060", colLeft, yPos);
    doc.text(`Dav\u010Dna \u0161tevilka: ${buyerTaxId ? buyerTaxId : "Ni navedena"}`, colRight, yPos);
    yPos += 12;
    doc.text("Mati\u010Dna \u0161tevilka: 9093494000", colLeft, yPos);
    if (buyerRegNo) {
      doc.text(`Mati\u010Dna \u0161tevilka: ${buyerRegNo}`, colRight, yPos);
    } else if (user.email) {
      doc.text(`E-po\u0161ta: ${user.email}`, colRight, yPos);
    }
    yPos += 18;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, yPos).lineTo(555, yPos).stroke();
    yPos += 14;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted).text("\u0160tevilka ra\u010Duna: ", colLeft, yPos, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(invoiceNo);
    yPos += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Datum izdaje in opravljene storitve: ", colLeft, yPos, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(paymentDate);
    yPos += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Obra\u010Dunsko obdobje naro\u010Dnine: ", colLeft, yPos, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(periodStr);
    yPos += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Na\u010Din pla\u010Dila: ", colLeft, yPos, { continued: true });
    setBold();
    doc.fillColor(colorDark).text(paymentMethod);
    yPos += 13;
    setRegular();
    doc.fillColor(colorMuted).text("Status pla\u010Dila: ", colLeft, yPos, { continued: true });
    setBold();
    doc.fillColor("#059669").text(`PLA\u010CANO (${paymentDate})`);
    yPos += 28;
    setBold();
    doc.fontSize(8).fillColor(colorDark);
    doc.text("OPIS STORITVE", 40, yPos);
    doc.text("KOLI\u010CINA", 300, yPos, { width: 50, align: "center" });
    doc.text("OSNOVA (\u20AC)", 360, yPos, { width: 85, align: "right" });
    doc.text("SKUPAJ (\u20AC)", 455, yPos, { width: 100, align: "right" });
    yPos += 13;
    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(40, yPos).lineTo(555, yPos).stroke();
    yPos += 10;
    setBold();
    doc.fontSize(9.5).fillColor(colorDark).text(planTitle, 40, yPos, { width: 250 });
    setRegular();
    doc.fontSize(9).text("1 mesec", 300, yPos, { width: 50, align: "center" });
    doc.text(formatEuro(baseAmount), 360, yPos, { width: 85, align: "right" });
    setBold();
    doc.text(formatEuro(totalAmount), 455, yPos, { width: 100, align: "right" });
    yPos += 14;
    setRegular();
    doc.fontSize(7.5).fillColor(colorLight).text(planDesc, 40, yPos, { width: 250 });
    yPos += 26;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, yPos).lineTo(555, yPos).stroke();
    yPos += 15;
    const totalsLeft = 325;
    const totalsValueRight = 555;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted).text("Osnova za DDV:", totalsLeft, yPos);
    setBold();
    doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(baseAmount)} \u20AC`, totalsLeft + 120, yPos, { width: 110, align: "right" });
    yPos += 15;
    setRegular();
    doc.fontSize(8.5).fillColor(colorMuted).text(isReverseCharge ? "DDV (Obrnjena dav\u010Dna obv.):" : "DDV (22%):", totalsLeft, yPos);
    setBold();
    doc.fontSize(8.5).fillColor(colorDark).text(`${formatEuro(vatAmount)} \u20AC`, totalsLeft + 120, yPos, { width: 110, align: "right" });
    yPos += 15;
    doc.strokeColor(colorDark).lineWidth(1.5).moveTo(totalsLeft, yPos).lineTo(totalsValueRight, yPos).stroke();
    yPos += 7;
    setBold();
    doc.fontSize(10).fillColor(colorDark).text("SKUPAJ ZA PLA\u010CILO:", totalsLeft, yPos);
    doc.fontSize(10.5).text(`${formatEuro(totalAmount)} \u20AC`, totalsLeft + 120, yPos, { width: 110, align: "right" });
    const footerY = 680;
    doc.strokeColor(colorBorder).lineWidth(1).moveTo(40, footerY).lineTo(555, footerY).stroke();
    let footY = footerY + 12;
    setRegular();
    doc.fontSize(7.5).fillColor(colorMuted);
    if (isReverseCharge) {
      doc.text(
        "Dizain d.o.o. je dav\u010Dni zavezanec za DDV v Sloveniji (ID za DDV: SI57008060). Obrnjena dav\u010Dna obveznost / Reverse charge po Direktivi Sveta 2006/112/ES in 76. a \u010Dlenu ZDDV-1.",
        40,
        footY,
        { width: 515 }
      );
    } else {
      doc.text(
        "Dizain d.o.o. je dav\u010Dni zavezanec za DDV v Sloveniji (ID za DDV: SI57008060). V ceno storitve je vklju\u010Den 22% DDV v skladu z Zakonom o davku na dodano vrednost (ZDDV-1).",
        40,
        footY,
        { width: 515 }
      );
    }
    footY += 16;
    doc.fontSize(7).fillColor(colorLight).text(
      "Dokument je bil izdan elektronsko s strani platforme dra\u017Ebenik.si / drazbe.si in je pravno veljaven brez podpisa in \u017Eiga. Za morebitna vpra\u0161anja glede naro\u010Dnine se obrnite na podpora@drazbe.si.",
      40,
      footY,
      { width: 515 }
    );
    doc.end();
  });
}

// src/lib/termsVersion.ts
var TERMS_VERSION = "2026-10-v2";

// src/server/app.ts
var resendClient2 = process.env.RESEND_API_KEY ? new import_resend2.Resend(process.env.RESEND_API_KEY) : null;
var adminEmailAddress = process.env.ADMIN_EMAIL || "info@drazbenik.si";
async function safeGetDocs(queryRef) {
  try {
    const snap = await queryRef.get();
    return {
      empty: snap.empty,
      size: snap.size,
      docs: snap.docs.map((d) => ({
        id: d.id,
        ref: d.ref,
        data: () => getDocSnapshotData(d) || {},
        exists: () => isDocSnapshotExists(d)
      }))
    };
  } catch (error) {
    console.warn("[safeGetDocs] Failed to fetch docs:", error.message);
    return { empty: true, size: 0, docs: [] };
  }
}
async function safeGetDoc(docRef) {
  try {
    const snap = await docRef.get();
    const exists = isDocSnapshotExists(snap);
    return {
      exists: () => exists,
      data: () => exists ? getDocSnapshotData(snap) : null,
      id: snap.id,
      ref: docRef
    };
  } catch (error) {
    console.warn("[safeGetDoc] Failed to fetch doc:", error.message);
    return {
      exists: () => false,
      data: () => null,
      id: docRef.id || "",
      ref: docRef
    };
  }
}
async function assertVerifiedUser(userId, userData) {
  let isEmailVerified = userData?.email_verified === true || userData?.is_verified === true;
  if (!isEmailVerified && userId) {
    try {
      const authUser = await adminAuth.getUser(userId);
      if (authUser?.emailVerified === true) {
        isEmailVerified = true;
      }
    } catch (e) {
    }
  }
  if (!isEmailVerified) {
    const err = new Error("Za to dejanje morate najprej potrditi svoj e-po\u0161tni naslov.");
    err.statusCode = 403;
    err.code = "EMAIL_NOT_VERIFIED";
    throw err;
  }
  if (userData?.profile_completed !== true) {
    const err = new Error("Za to dejanje morate najprej dopolniti svoj profil (Nastavitve, Osebni podatki).");
    err.statusCode = 403;
    err.code = "PROFILE_INCOMPLETE";
    throw err;
  }
  if (userData?.terms_version !== TERMS_VERSION) {
    const err = new Error("Za to dejanje morate najprej sprejeti posodobljene pogoje uporabe.");
    err.statusCode = 403;
    err.code = "TERMS_REQUIRED";
    throw err;
  }
}
var EU_COUNTRIES_SET = /* @__PURE__ */ new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE"
]);
async function isViesValid(countryCode, vatId) {
  if (!countryCode || !vatId) return false;
  const cc = countryCode.trim().toUpperCase();
  let num = vatId.trim().replace(/[\s\.-]/g, "");
  if (num.startsWith(cc)) {
    num = num.substring(cc.length);
  }
  if (!num) return false;
  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${cc}/vat/${num}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4e3);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.isValid === true;
  } catch (e) {
    clearTimeout(timeout);
    return false;
  }
}
async function getSellerPayoutAccount(sellerId) {
  if (!sellerId) {
    const err = new Error("Missing seller ID");
    err.code = "SELLER_PAYOUTS_NOT_READY";
    throw err;
  }
  const sellerDoc = await safeGetDoc(adminDb.collection("users").doc(sellerId));
  if (!sellerDoc.exists()) {
    const err = new Error("Seller user not found");
    err.code = "SELLER_PAYOUTS_NOT_READY";
    throw err;
  }
  const seller = sellerDoc.data() || {};
  const stripeAccountId = seller.stripe_account_id || seller.stripeAccountId;
  if (!seller.stripe_onboarding_complete || !stripeAccountId) {
    const err = new Error("Prodajalec \u0161e nima urejenih izpla\u010Dil.");
    err.code = "SELLER_PAYOUTS_NOT_READY";
    throw err;
  }
  return stripeAccountId;
}
async function getBuyerTaxContext(userId, userData) {
  const countryCode = (userData?.country_code || "SI").trim().toUpperCase();
  const isBusiness = Boolean(
    userData?.company_status === "company" || userData?.user_type === "company" || userData?.company_name
  );
  const rawVatId = userData?.tax_id || userData?.vat_id || "";
  const hasVatIdInput = Boolean(rawVatId.trim());
  if (!isBusiness || !hasVatIdInput || countryCode === "SI" || !EU_COUNTRIES_SET.has(countryCode)) {
    return {
      countryCode,
      isBusiness,
      hasValidVatId: false
    };
  }
  const checkKey = `${countryCode}${rawVatId.trim()}`;
  const cachedFor = userData?.vies_checked_for;
  const cachedValid = userData?.vies_valid;
  const cachedAt = userData?.vies_checked_at;
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1e3;
  if (cachedFor === checkKey && typeof cachedValid === "boolean" && cachedAt) {
    const checkedTime = new Date(cachedAt).getTime();
    if (!isNaN(checkedTime) && now - checkedTime < twentyFourHours) {
      return {
        countryCode,
        isBusiness,
        hasValidVatId: cachedValid
      };
    }
  }
  const valid = await isViesValid(countryCode, rawVatId);
  try {
    await adminDb.collection("users").doc(userId).set({
      vies_checked_for: checkKey,
      vies_valid: valid,
      vies_checked_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn("[getBuyerTaxContext] Failed to cache VIES result:", e);
  }
  return {
    countryCode,
    isBusiness,
    hasValidVatId: valid
  };
}
async function computeBuyerTotals(buyerId, buyerData, itemPriceCents) {
  const tier = getEffectiveTier(buyerData);
  const taxCtx = await getBuyerTaxContext(buyerId, buyerData);
  const totals = calculateTotals({
    itemPriceCents,
    tier,
    countryCode: taxCtx.countryCode,
    isBusiness: taxCtx.isBusiness,
    hasValidVatId: taxCtx.hasValidVatId
  });
  return {
    ...totals,
    tier
  };
}
function buildStripeAccountPrefill(user) {
  const isBusiness = user?.user_type === "business" || user?.userType === "business";
  const businessType = isBusiness ? "company" : "individual";
  let formattedPhone = void 0;
  if (user?.phone && typeof user.phone === "string") {
    let phone = user.phone.replace(/[^0-9+]/g, "");
    if (phone.startsWith("00")) {
      formattedPhone = "+" + phone.substring(2);
    } else if (phone.startsWith("0")) {
      formattedPhone = "+386" + phone.substring(1);
    } else if (!phone.startsWith("+")) {
      formattedPhone = "+386" + phone;
    } else {
      formattedPhone = phone;
    }
    if (!formattedPhone || formattedPhone.trim() === "+" || formattedPhone.trim() === "+386") {
      formattedPhone = void 0;
    }
  }
  const name = isBusiness ? user?.company_name || user?.companyName || void 0 : `${user?.first_name || user?.firstName || ""} ${user?.last_name || user?.lastName || ""}`.trim() || void 0;
  const businessProfile = {
    mcc: "5999",
    product_description: "Prodaja predmetov preko platforme dra\u017Ebenik.si",
    url: "https://www.drazbe.eu"
  };
  if (user?.email && String(user.email).trim()) businessProfile.support_email = String(user.email).trim();
  if (formattedPhone) businessProfile.support_phone = formattedPhone;
  if (name) businessProfile.name = name;
  function cleanAddress(addr) {
    const res = {};
    if (addr.line1 && addr.line1.trim()) res.line1 = addr.line1.trim();
    if (addr.city && addr.city.trim()) res.city = addr.city.trim();
    if (addr.postal_code && addr.postal_code.trim()) res.postal_code = addr.postal_code.trim();
    if (addr.country && addr.country.trim()) res.country = addr.country.trim();
    return Object.keys(res).length > 0 ? res : void 0;
  }
  const result = {
    business_type: businessType,
    business_profile: businessProfile
  };
  if (user?.email && String(user.email).trim()) {
    result.email = String(user.email).trim();
  }
  if (isBusiness) {
    const compAddress = cleanAddress({
      line1: user?.company_street || user?.companyStreet || user?.street || user?.address?.street,
      city: user?.company_city || user?.companyCity || user?.city || user?.address?.city,
      postal_code: user?.company_postal_code || user?.companyPostalCode || user?.postal_code || user?.postalCode || user?.address?.postcode,
      country: user?.country_code || "SI"
    });
    const company = {};
    if (formattedPhone) company.phone = formattedPhone;
    const companyName = user?.company_name || user?.companyName;
    if (companyName && String(companyName).trim()) company.name = String(companyName).trim();
    const taxId = user?.tax_number || user?.taxNumber || user?.tax_id || user?.vat_id || user?.vatId;
    if (taxId && String(taxId).trim()) company.tax_id = String(taxId).trim();
    const regNum = user?.registration_number || user?.regNumber || user?.registrationNumber;
    if (regNum && String(regNum).trim()) company.registration_number = String(regNum).trim();
    const vatId = user?.vat_id || user?.vatId;
    if (vatId && String(vatId).trim()) company.vat_id = String(vatId).trim();
    if (compAddress) company.address = compAddress;
    if (Object.keys(company).length > 0) {
      result.company = company;
    }
  } else {
    const indAddress = cleanAddress({
      line1: user?.street || user?.address?.street,
      city: user?.city || user?.address?.city,
      postal_code: user?.postal_code || user?.postalCode || user?.address?.postcode,
      country: user?.country_code || "SI"
    });
    const individual = {};
    if (formattedPhone) individual.phone = formattedPhone;
    const firstName = user?.first_name || user?.firstName;
    if (firstName && String(firstName).trim()) individual.first_name = String(firstName).trim();
    const lastName = user?.last_name || user?.lastName;
    if (lastName && String(lastName).trim()) individual.last_name = String(lastName).trim();
    if (user?.email && String(user.email).trim()) individual.email = String(user.email).trim();
    if (indAddress) individual.address = indAddress;
    if (Object.keys(individual).length > 0) {
      result.individual = individual;
    }
  }
  return result;
}
function isStripeAccountReady(account) {
  return account.details_submitted === true && account.payouts_enabled === true && account.capabilities?.transfers === "active";
}
async function ensureSellerStripeAccount(userId, user) {
  const stripe = getStripe();
  let accountId = user?.stripe_account_id || user?.stripeAccountId;
  const prefill = buildStripeAccountPrefill(user);
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: user?.country_code || "SI",
      capabilities: {
        transfers: { requested: true }
      },
      settings: {
        payouts: {
          schedule: { interval: "manual" }
        }
      },
      metadata: {
        firebase_uid: userId
      },
      ...prefill
    });
    accountId = account.id;
    await adminDb.collection("users").doc(userId).set({
      stripe_account_id: accountId,
      stripeAccountId: accountId
    }, { merge: true });
  } else {
    if (!user?.stripe_account_id || !user?.stripeAccountId) {
      await adminDb.collection("users").doc(userId).set({
        stripe_account_id: accountId,
        stripeAccountId: accountId
      }, { merge: true });
    }
    if (!user?.stripe_onboarding_complete) {
      try {
        await stripe.accounts.update(accountId, {
          ...prefill,
          settings: {
            payouts: {
              schedule: { interval: "manual" }
            }
          }
        });
      } catch (e) {
        console.warn(`[ensureSellerStripeAccount] Account update failed for ${accountId}:`, e.message);
      }
    }
  }
  return accountId;
}
async function generateInvoiceNumber(type) {
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const docId = `${type}_${year}`;
  const counterRef = adminDb.collection("invoice_counters").doc(docId);
  return await adminDb.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let currentNumber = 1;
    if (isDocSnapshotExists(counterDoc)) {
      const data = getDocSnapshotData(counterDoc);
      currentNumber = (data?.current_number || 0) + 1;
      transaction.update(counterRef, { current_number: currentNumber });
    } else {
      transaction.set(counterRef, {
        type,
        year,
        current_number: 1
      });
    }
    const prefix = type === "SALES" ? "RAC" : type === "SUBSCRIPTION" ? "NAR" : "PROV";
    const formattedNum = String(currentNumber).padStart(6, "0");
    return `${prefix}-${year}-${formattedNum}`;
  });
}
async function createAndSendSubscriptionInvoice(params) {
  const { userId, packageId, amountTotal, sourceId, paymentMethod = "Spletno pla\u010Dilo / Kartica (Stripe)", periodStart, periodEnd } = params;
  try {
    const existing = await safeGetDocs(
      adminDb.collection("documents").where("user_id", "==", userId).where("source_id", "==", sourceId).limit(1)
    );
    if (!existing.empty) {
      console.log(`[subscription-invoice] Ra\u010Dun za naro\u010Dnino (sourceId: ${sourceId}) \u017Ee obstaja. Preskakujem.`);
      return;
    }
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(userId));
    const userData = userDoc.data() || {};
    const invoiceNo = await generateInvoiceNumber("SUBSCRIPTION");
    const pdfBuffer = await generateSubscriptionInvoicePDF({
      invoiceNo,
      user: userData,
      planId: packageId,
      amount: amountTotal,
      paymentMethod,
      periodStart: periodStart || /* @__PURE__ */ new Date(),
      periodEnd: periodEnd || void 0
    });
    const fileName = `racun_${invoiceNo}.pdf`;
    let invoicePath = null;
    try {
      invoicePath = await uploadBufferToStorage(pdfBuffer, `${userId}/${fileName}`);
    } catch (uploadErr) {
      console.warn("[subscription-invoice] Napaka pri nalaganju v Storage:", uploadErr.message);
    }
    await adminDb.collection("documents").add({
      user_id: userId,
      type: "subscription_invoice",
      invoice_no: invoiceNo,
      package_id: packageId,
      amount: amountTotal,
      source_id: sourceId,
      payment_method: paymentMethod,
      invoice_path: invoicePath,
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    console.log(`[subscription-invoice] Uspe\u0161no shranjen dokument ra\u010Duna ${invoiceNo} za uporabnika ${userId}`);
    const targetEmail = userData.email;
    if (targetEmail && process.env.RESEND_API_KEY) {
      try {
        const isPro = String(packageId).toUpperCase().includes("PRO");
        const planName = isPro ? "NAPREDNI" : "OSNOVNI";
        const formattedAmount = Number(amountTotal).toFixed(2);
        const recipientName = userData.company_name || userData.first_name || userData.username || "uporabnik";
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #0A1128; background: #ffffff;">
            <div style="border-bottom: 2px solid #E2E8F0; padding-bottom: 16px; margin-bottom: 24px;">
              <h1 style="color: #0A1128; font-size: 24px; font-weight: 900; margin: 0; text-transform: uppercase;">dra\u017Ebe.si</h1>
              <p style="color: #94A3B8; font-size: 12px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Ra\u010Dun za naro\u010Dnino</p>
            </div>
            <p style="font-size: 16px; line-height: 1.5; color: #334155;">Pozdravljeni, <strong>${recipientName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.5; color: #334155;">
              Zahvaljujemo se vam za zaupanje! Va\u0161a naro\u010Dnina na paket <strong>${planName}</strong> je bila uspe\u0161no aktivirana oz. obnovljena.
            </p>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 20px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">\u0160tevilka ra\u010Duna:</td>
                  <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0A1128;">${invoiceNo}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Paket naro\u010Dnine:</td>
                  <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0A1128;">Paket ${planName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Pla\u010Dani znesek:</td>
                  <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0A1128;">${formattedAmount} \u20AC (vklj. z 22% DDV)</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Na\u010Din pla\u010Dila:</td>
                  <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #0A1128;">${paymentMethod}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748B;">Status:</td>
                  <td style="padding: 6px 0; font-weight: 700; text-align: right; color: #059669;">PLA\u010CANO</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 14px; line-height: 1.5; color: #64748B;">
              Uradni PDF ra\u010Dun za va\u0161 nakup je prilo\u017Een temu sporo\u010Dilu (<strong>${fileName}</strong>). Vse ugodnosti va\u0161ega paketa so \u017Ee na voljo v va\u0161em uporabni\u0161kem ra\u010Dunu.
            </p>
            <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center;">
              <p style="margin: 0;">Dizain d.o.o., Karantanska ulica 28, 2000 Maribor | ID za DDV: SI57008060</p>
              <p style="margin: 4px 0 0 0;">Sporo\u010Dilo je bilo samodejno generirano s strani sistema dra\u017Ebe.si.</p>
            </div>
          </div>
        `;
        const resendClient3 = new import_resend2.Resend(process.env.RESEND_API_KEY);
        await resendClient3.emails.send({
          from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
          to: targetEmail,
          subject: `Ra\u010Dun za naro\u010Dnino \u0161t. ${invoiceNo} - dra\u017Ebenik.si`,
          html: emailHtml,
          attachments: [
            {
              filename: fileName,
              content: pdfBuffer
            }
          ]
        });
        console.log(`[subscription-invoice] E-po\u0161tni ra\u010Dun uspe\u0161no poslan na ${targetEmail}`);
      } catch (emailErr) {
        console.error("[subscription-invoice] Napaka pri po\u0161iljanju e-po\u0161tnega ra\u010Duna:", emailErr.message);
      }
    }
  } catch (err) {
    console.error("[subscription-invoice] Napaka pri obdelavi ra\u010Duna za naro\u010Dnino:", err.message);
  }
}
function formatE164Phone(phoneStr, defaultCountry = "SI") {
  if (!phoneStr || typeof phoneStr !== "string") return void 0;
  const cleaned = phoneStr.trim();
  if (!cleaned) return void 0;
  const digits = cleaned.replace(/[^0-9+]/g, "");
  if (!digits) return void 0;
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return "+" + digits.substring(2);
  if (digits.startsWith("0")) {
    if (defaultCountry === "SI") return "+386" + digits.substring(1);
    if (defaultCountry === "AT") return "+43" + digits.substring(1);
    if (defaultCountry === "DE") return "+49" + digits.substring(1);
    if (defaultCountry === "HR") return "+385" + digits.substring(1);
    if (defaultCountry === "IT") return "+39" + digits.substring(1);
    return "+386" + digits.substring(1);
  }
  return "+386" + digits;
}
function getCustomerFullName(user) {
  if (!user) return "";
  const first = (user.first_name || user.firstName || "").trim();
  const last = (user.last_name || user.lastName || "").trim();
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  if (user.company_name || user.companyName) return (user.company_name || user.companyName).trim();
  if (user.representative) return user.representative.trim();
  if (user.name) return user.name.trim();
  if (user.displayName) return user.displayName.trim();
  if (user.username) return user.username.trim();
  return "";
}
function getCustomerAddress(user) {
  if (!user) return void 0;
  const isBusiness = user.user_type === "business" || user.userType === "business";
  const line1 = (isBusiness ? user.company_street || user.companyStreet : null) || user.street || (typeof user.address === "string" ? user.address : user.address?.street) || user.company_street || user.companyStreet || void 0;
  const city = (isBusiness ? user.company_city || user.companyCity : null) || user.city || user.address?.city || user.company_city || user.companyCity || void 0;
  const postal_code = (isBusiness ? user.company_postal_code || user.companyPostalCode : null) || user.postal_code || user.postalCode || user.address?.postcode || user.company_postal_code || user.companyPostalCode || void 0;
  const country = user.country_code || user.countryCode || (user.address && typeof user.address === "object" ? user.address.country : null) || "SI";
  if (!line1 && !city && !postal_code && !country) {
    return void 0;
  }
  return {
    line1: line1 || void 0,
    city: city || void 0,
    postal_code: postal_code || void 0,
    country: country || "SI"
  };
}
async function getOrCreateStripeCustomer(stripe, userId, user) {
  if (!user || !user.email) return null;
  const email = user.email.trim();
  const name = getCustomerFullName(user);
  const phone = formatE164Phone(user.phone || user.phoneNumber || user.telephone, user.country_code || "SI");
  const address = getCustomerAddress(user);
  let customerId = user.stripe_customer_id || user.stripeCustomerId;
  const customerPayload = {
    email,
    ...name ? { name } : {},
    ...phone ? { phone } : {},
    ...address ? { address } : {},
    metadata: {
      user_id: userId,
      user_type: user.user_type || user.userType || "individual"
    }
  };
  if (customerId) {
    try {
      await stripe.customers.update(customerId, customerPayload);
      return customerId;
    } catch (e) {
      console.warn("Could not update existing stripe customer, will search or create fresh:", e.message);
      customerId = null;
    }
  }
  if (!customerId) {
    try {
      const existingList = await stripe.customers.list({ email, limit: 1 });
      if (existingList.data.length > 0) {
        customerId = existingList.data[0].id;
        await stripe.customers.update(customerId, customerPayload);
      } else {
        const newCustomer = await stripe.customers.create(customerPayload);
        customerId = newCustomer.id;
      }
      if (userId && customerId) {
        await adminDb.collection("users").doc(userId).set({
          stripe_customer_id: customerId,
          stripeCustomerId: customerId
        }, { merge: true });
      }
    } catch (e) {
      console.error("Error creating/linking stripe customer:", e.message);
    }
  }
  return customerId;
}
var stripeClient = null;
function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is required");
    }
    stripeClient = new import_stripe.default(key);
  }
  return stripeClient;
}
function getBidIncrement(price) {
  if (price < 50) return 1;
  if (price < 500) return 5;
  if (price < 2e3) return 20;
  if (price < 5e3) return 50;
  return 100;
}
function maskUsername(name) {
  const clean = (name || "").trim();
  if (!clean || clean.length < 2) return "U***r";
  return `${clean[0]}***${clean[clean.length - 1]}`;
}
async function recordSaleCompletion(auctionId, sellerIdOverride) {
  try {
    if (!auctionId) return;
    const auctionRef = adminDb.collection("auctions").doc(auctionId);
    const snap = await safeGetDoc(auctionRef);
    if (!snap.exists) return;
    const data = snap.data() || {};
    if (data.sold_count_recorded) return;
    const sellerId = sellerIdOverride || data.seller_id || data.sellerId;
    await auctionRef.update({ sold_count_recorded: true });
    if (sellerId) {
      await adminDb.collection("users").doc(sellerId).set({
        sold_count: import_firestore.FieldValue.increment(1)
      }, { merge: true });
      await syncPublicProfile(sellerId);
    }
  } catch (err) {
    console.error(`[recordSaleCompletion] Error for auction ${auctionId}:`, err);
  }
}
function getLjubljanaYear() {
  const currentYearStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Ljubljana",
    year: "numeric"
  }).format(/* @__PURE__ */ new Date());
  const currentYear = parseInt(currentYearStr, 10) || (/* @__PURE__ */ new Date()).getFullYear();
  return { currentYear, currentYearStr };
}
async function recordAmlSpend({
  buyerId,
  amountEur,
  uniqueKey,
  transaction
}) {
  if (!buyerId || !uniqueKey || amountEur <= 0) {
    return { recorded: false, already_recorded: false };
  }
  const { currentYear } = getLjubljanaYear();
  const logRef = adminDb.collection("aml_spend_log").doc(uniqueKey);
  const buyerRef = adminDb.collection("users").doc(buyerId);
  const nowISO = (/* @__PURE__ */ new Date()).toISOString();
  const runWithTx = async (t) => {
    const logDoc = await t.get(logRef);
    if (logDoc.exists) {
      return { recorded: false, already_recorded: true };
    }
    const buyerDoc = await t.get(buyerRef);
    const buyer = buyerDoc.data() || {};
    const isCurrentYear = buyer.yearly_spent_year === currentYear;
    const previousYearlySpent = isCurrentYear ? Number(buyer.yearly_spent) || 0 : 0;
    const newYearlySpent = previousYearlySpent + amountEur;
    t.set(logRef, {
      buyer_id: buyerId,
      amount_eur: amountEur,
      year: currentYear,
      created_at: nowISO
    });
    t.set(buyerRef, {
      yearly_spent: newYearlySpent,
      yearly_spent_year: currentYear,
      [`yearly_spent_by_year.${currentYear}`]: import_firestore.FieldValue.increment(amountEur),
      total_spent: import_firestore.FieldValue.increment(amountEur),
      purchases_count: import_firestore.FieldValue.increment(1),
      last_purchase_at: nowISO
    }, { merge: true });
    return { recorded: true, already_recorded: false };
  };
  if (transaction) {
    return await runWithTx(transaction);
  } else {
    return await adminDb.runTransaction(runWithTx);
  }
}
async function reserveAmlAmount({
  buyerId,
  auctionId,
  amountEur
}) {
  if (!buyerId || !auctionId || amountEur <= 0) {
    return { reservationId: `${buyerId}_${auctionId}`, expiresAt: "" };
  }
  const reservationId = `${buyerId}_${auctionId}`;
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1e3).toISOString();
  const createdAt = now.toISOString();
  const currentYearStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Ljubljana",
    year: "numeric"
  }).format(now);
  const currentYear = parseInt(currentYearStr, 10) || now.getFullYear();
  await adminDb.runTransaction(async (t) => {
    const buyerRef = adminDb.collection("users").doc(buyerId);
    const buyerDoc = await t.get(buyerRef);
    const buyer = buyerDoc.data() || {};
    if (buyer.identity_verified !== true) {
      let currentYearSpent = 0;
      if (buyer.yearly_spent_by_year && buyer.yearly_spent_by_year[currentYear] !== void 0) {
        currentYearSpent = Number(buyer.yearly_spent_by_year[currentYear]) || 0;
      } else if (buyer.yearly_spent_by_year && buyer.yearly_spent_by_year[currentYearStr] !== void 0) {
        currentYearSpent = Number(buyer.yearly_spent_by_year[currentYearStr]) || 0;
      } else if ((buyer.yearly_spent_year === currentYear || buyer.yearly_spent_year === currentYearStr) && typeof buyer.yearly_spent === "number") {
        currentYearSpent = buyer.yearly_spent;
      }
      const activeReservationsQuery = adminDb.collection("aml_reservations").where("buyer_id", "==", buyerId).where("status", "==", "active");
      const activeResSnap = await t.get(activeReservationsQuery);
      const nowTime = now.getTime();
      let otherActiveReservationsSum = 0;
      for (const doc of activeResSnap.docs) {
        if (doc.id === reservationId) {
          continue;
        }
        const data = doc.data();
        if (data.expires_at) {
          const expTime = new Date(data.expires_at).getTime();
          if (expTime > nowTime) {
            otherActiveReservationsSum += Number(data.amount_eur) || 0;
          }
        }
      }
      const projectedTotal = currentYearSpent + otherActiveReservationsSum + amountEur;
      if (projectedTotal > 1e4) {
        const err = new Error("V skladu z zakonodajo EU (ZPPDFT-2 / AML) je za skupne letne nakupe nad 10.000 \u20AC obvezna identifikacija z osebnim dokumentom. Prosimo, verificirajte svoj profil v nastavitvah pred nadaljevanjem.");
        err.statusCode = 400;
        throw err;
      }
    }
    const reservationRef = adminDb.collection("aml_reservations").doc(reservationId);
    t.set(reservationRef, {
      buyer_id: buyerId,
      auction_id: auctionId,
      amount_eur: amountEur,
      year: currentYear,
      status: "active",
      expires_at: expiresAt,
      created_at: createdAt
    }, { merge: true });
  });
  return { reservationId, expiresAt };
}
var app = (0, import_express.default)();
var defaultAllowedOrigins = [
  "https://drazbe.eu",
  "https://www.drazbe.eu",
  "https://drazbenik.si",
  "https://www.drazbenik.si",
  "http://localhost:3000"
];
app.use((0, import_cors.default)({
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    const allowed = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : defaultAllowedOrigins;
    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  }
}));
app.use((req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/ https://js.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://www.google.com/recaptcha/ https://api.stripe.com ws: wss:; frame-src 'self' https://www.google.com/recaptcha/ https://js.stripe.com; img-src 'self' data: https: blob:;");
  }
  next();
});
var authRateLimiter = null;
var placeBidRateLimiter = null;
var createAuctionRateLimiter = null;
var checkoutPaymentRateLimiter = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new import_redis.Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN
  });
  authRateLimiter = new import_ratelimit.Ratelimit({
    redis,
    limiter: import_ratelimit.Ratelimit.slidingWindow(5, "1 m"),
    prefix: "ratelimit_auth",
    analytics: true
  });
  placeBidRateLimiter = new import_ratelimit.Ratelimit({
    redis,
    limiter: import_ratelimit.Ratelimit.slidingWindow(30, "1 m"),
    prefix: "ratelimit_bid",
    analytics: true
  });
  createAuctionRateLimiter = new import_ratelimit.Ratelimit({
    redis,
    limiter: import_ratelimit.Ratelimit.slidingWindow(10, "1 h"),
    prefix: "ratelimit_auction",
    analytics: true
  });
  checkoutPaymentRateLimiter = new import_ratelimit.Ratelimit({
    redis,
    limiter: import_ratelimit.Ratelimit.slidingWindow(10, "1 m"),
    prefix: "ratelimit_payment",
    analytics: true
  });
} else {
  console.warn("Upstash Redis not configured. Rate limiting is disabled.");
}
app.use(async (req, res, next) => {
  if (req.path === "/api/auth/verify-captcha" || req.path === "/api/auth/send-verification" || req.path === "/api/auth/send-password-reset") {
    if (authRateLimiter) {
      const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
      const identifier = Array.isArray(ip) ? ip[0] : ip;
      try {
        const { success } = await authRateLimiter.limit(identifier);
        if (!success) {
          return res.status(429).json({ error: "Preve\u010D zahtev. Prosimo, poskusite kasneje." });
        }
      } catch (err) {
        console.warn("Rate limit check failed, skipping blocking:", err);
      }
    }
  }
  next();
});
app.use((req, _res, next) => {
  if (process.env.VERCEL) {
    const matchedPath = req.headers["x-matched-path"] || req.headers["x-invoke-path"];
    let resolvedUrl = req.url || "/";
    if (matchedPath && matchedPath.startsWith("/api")) {
      resolvedUrl = matchedPath;
    } else if (req.originalUrl && req.originalUrl.startsWith("/api") && (req.url === "/" || req.url.startsWith("/api/index") || req.url === "")) {
      resolvedUrl = req.originalUrl;
    } else if (!resolvedUrl.startsWith("/api") && !resolvedUrl.startsWith("/webhook")) {
      resolvedUrl = "/api" + (resolvedUrl.startsWith("/") ? resolvedUrl : "/" + resolvedUrl);
    }
    resolvedUrl = resolvedUrl.replace(/^\/api\/api\//, "/api/");
    if (resolvedUrl === "/api/index.ts" || resolvedUrl === "/api/index") {
      if (req.originalUrl && req.originalUrl !== resolvedUrl) {
        resolvedUrl = req.originalUrl;
      }
    }
    req.url = resolvedUrl;
  }
  next();
});
function isPostalDelivery(method) {
  if (typeof method !== "string") return false;
  return ["post", "shipping"].includes(method);
}
async function refundTransactionToBuyer(txId, reason) {
  const txRef = adminDb.collection("transactions").doc(txId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  try {
    const txResult = await adminDb.runTransaction(async (t) => {
      const txDoc = await t.get(txRef);
      if (!txDoc.exists) return { ok: false, status: "not_found", tx: null };
      const data = txDoc.data() || {};
      if (data.payout_status === "paid_out") return { ok: false, status: "already_paid_out", tx: null };
      if (data.payout_status === "refunded") return { ok: true, status: "already_refunded", tx: data };
      if (!["held", "frozen", "release_waiting_funds", "release_failed"].includes(data.payout_status)) return { ok: false, status: "cannot_refund", tx: data };
      return { ok: true, status: "success", tx: data };
    });
    if (!txResult.ok) return { ok: false, status: txResult.status };
    const tx = txResult.tx;
    if (!tx) return { ok: false, status: txResult.status };
    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: tx.stripe_payment_intent_id,
      reverse_transfer: true,
      refund_application_fee: true,
      metadata: { tx_id: txId }
    }, { idempotencyKey: "refund_" + txId });
    await txRef.update({
      payout_status: "refunded",
      refund_id: refund.id,
      refunded_at: now,
      refund_reason: reason,
      status: reason === "seller_no_shipment" ? "CANCELLED" : "REFUNDED"
    });
    const buyerId = tx.buyer_id || tx.buyerId;
    if (buyerId) {
      await recordAmlSpend({ buyerId, amountEur: -tx.amount_total, uniqueKey: "refund_" + txId });
    }
    return { ok: true, status: "success" };
  } catch (err) {
    console.error(`[refundTransactionToBuyer] Error for tx ${txId}:`, err.message);
    return { ok: false, status: "error" };
  }
}
async function releaseSellerPayout(txId, reason) {
  const txRef = adminDb.collection("transactions").doc(txId);
  const nowMs = Date.now();
  const leaseUntil = nowMs + 3e4;
  try {
    const txResult = await adminDb.runTransaction(async (t) => {
      const txDoc = await t.get(txRef);
      if (!txDoc.exists) {
        return { ok: false, status: "not_found", tx: null };
      }
      const data = txDoc.data() || {};
      if (data.payout_status === "paid_out") {
        return { ok: true, status: "paid_out", tx: data };
      }
      if (data.payout_status === "frozen" || data.payout_status === "refunded") {
        return { ok: false, status: data.payout_status, tx: data };
      }
      if (typeof data.payout_lease_until === "number" && data.payout_lease_until > nowMs) {
        return { ok: false, status: "leased", tx: data };
      }
      t.update(txRef, {
        payout_lease_until: leaseUntil
      });
      return { ok: true, status: "leasing_success", tx: data };
    });
    if (!txResult.ok) {
      return { ok: false, status: txResult.status };
    }
    if (txResult.status === "paid_out") {
      return { ok: true, status: "paid_out" };
    }
    const tx = txResult.tx;
    if (!tx) {
      return { ok: false, status: "not_found" };
    }
    const sellerStripeAccountId = tx.seller_stripe_account_id;
    const sellerNetCents = tx.seller_net_cents;
    if (!sellerStripeAccountId || !sellerNetCents) {
      await txRef.update({ payout_lease_until: 0 });
      return { ok: false, status: "missing_stripe_info" };
    }
    const stripe = getStripe();
    let balance;
    try {
      balance = await stripe.balance.retrieve({}, { stripeAccount: sellerStripeAccountId });
    } catch (balErr) {
      console.error("[releaseSellerPayout] Error retrieving seller balance:", balErr.message);
      await txRef.update({ payout_lease_until: 0 });
      return { ok: false, status: "balance_check_failed" };
    }
    const availableEurCents = balance.available.find((b) => b.currency === "eur")?.amount || 0;
    if (availableEurCents < sellerNetCents) {
      await txRef.update({
        payout_status: "release_waiting_funds",
        payout_lease_until: 0
      });
      return { ok: false, status: "release_waiting_funds" };
    }
    try {
      const payout = await stripe.payouts.create({
        amount: sellerNetCents,
        currency: "eur",
        metadata: { tx_id: txId, auction_id: tx.auction_id || "" }
      }, {
        stripeAccount: sellerStripeAccountId,
        // Schluessel je Versuchsfolge, sonst wiederholt Stripe einen endgueltigen Fehlschlag
        idempotencyKey: "payout_" + txId + "_" + (tx.payout_key_seq || 0)
      });
      await txRef.update({
        payout_status: "paid_out",
        payout_id: payout.id,
        paid_out_at: (/* @__PURE__ */ new Date()).toISOString(),
        release_reason: reason,
        status: "COMPLETED",
        payout_lease_until: 0
      });
      try {
        const sellerDoc = await safeGetDoc(adminDb.collection("users").doc(tx.seller_id));
        const seller = sellerDoc.data();
        if (seller?.email && process.env.RESEND_API_KEY) {
          const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(tx.auction_id));
          const auction = auctionDoc.data();
          const auctionTitleText = auction?.title?.SLO || auction?.title?.EN || "Predmet dra\u017Ebe";
          const resendClient3 = new import_resend2.Resend(process.env.RESEND_API_KEY);
          await resendClient3.emails.send({
            from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
            to: seller.email,
            subject: "Izpla\u010Dilo izvedeno",
            html: `<p>Izpla\u010Dilo za dra\u017Ebo <strong>${auctionTitleText}</strong> v vi\u0161ini <strong>${(tx.seller_net_cents / 100).toFixed(2)}</strong> EUR je bilo uspe\u0161no izvedeno na va\u0161 povezan Stripe ra\u010Dun.</p>`
          });
        }
      } catch (emErr) {
        console.error("[releaseSellerPayout] Error sending success email:", emErr.message);
      }
      return { ok: true, status: "paid_out" };
    } catch (payoutErr) {
      console.error("[releaseSellerPayout] Stripe Payout Creation failed:", payoutErr.message);
      const safeErr = formatStripeError(payoutErr);
      const attempts = (tx.payout_attempts || 0) + 1;
      const nextAttempt = attempts < PAYOUT_MAX_ATTEMPTS ? new Date(Date.now() + 6 * 60 * 60 * 1e3).toISOString() : null;
      await txRef.update({
        payout_status: "release_failed",
        payout_error: safeErr.userMessage,
        payout_attempts: attempts,
        // Bei Verbindungsfehlern denselben Schluessel behalten, die Auszahlung koennte angekommen sein
        payout_key_seq: payoutErr?.type === "StripeConnectionError" || payoutErr?.type === "StripeAPIError" ? tx.payout_key_seq || 0 : (tx.payout_key_seq || 0) + 1,
        next_payout_attempt_at: nextAttempt,
        payout_lease_until: 0
      });
      return { ok: false, status: "release_failed" };
    }
  } catch (err) {
    console.error("[releaseSellerPayout] Unexpected error:", err.message);
    try {
      await txRef.update({ payout_lease_until: 0 });
    } catch (_) {
    }
    return { ok: false, status: "unexpected_error" };
  }
}
async function finalizeAuctionPayment(params) {
  const { auctionId, buyerId, sellerId, paymentRef, amountTotalCents, stripeSessionId } = params;
  const txDocRef = adminDb.collection("transactions").doc(`tx_${paymentRef}`);
  const nowMs = Date.now();
  const leaseUntil = nowMs + 12e4;
  const txResult = await adminDb.runTransaction(async (t) => {
    const txDoc = await t.get(txDocRef);
    if (txDoc.exists) {
      const data = txDoc.data() || {};
      if (data.finalized === true) {
        return { alreadyProcessed: true };
      }
      if (data.finalized !== true && typeof data.lease_until === "number" && data.lease_until > nowMs) {
        return { alreadyProcessed: true };
      }
      t.set(txDocRef, {
        lease_until: leaseUntil,
        status: "processing",
        finalized: false,
        stripe_payment_intent_id: paymentRef,
        ...stripeSessionId ? { stripe_session_id: stripeSessionId } : {},
        auction_id: auctionId,
        buyer_id: buyerId,
        seller_id: sellerId
      }, { merge: true });
    } else {
      t.set(txDocRef, {
        auction_id: auctionId,
        buyer_id: buyerId,
        seller_id: sellerId,
        stripe_payment_intent_id: paymentRef,
        ...stripeSessionId ? { stripe_session_id: stripeSessionId } : {},
        status: "processing",
        finalized: false,
        lease_until: leaseUntil,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    return { alreadyProcessed: false };
  });
  if (txResult.alreadyProcessed) {
    return { alreadyProcessed: true };
  }
  try {
    const buyerDoc = await safeGetDoc(adminDb.collection("users").doc(buyerId));
    const buyer = buyerDoc.data() || {};
    const sellerDoc = await safeGetDoc(adminDb.collection("users").doc(sellerId));
    const seller = sellerDoc.data();
    if (!buyer || !seller) throw new Error("Buyer or seller not found");
    let itemCents = 0;
    let feeCents = 0;
    let vatCents = 0;
    let vatRate = 22;
    let isReverseCharge = false;
    let meta = {};
    try {
      const stripe = getStripe();
      if (stripeSessionId) {
        const sess = await stripe.checkout.sessions.retrieve(stripeSessionId, { expand: ["payment_intent"] });
        meta = sess.metadata || {};
        if (!meta.item_cents && sess.payment_intent && typeof sess.payment_intent === "object") {
          meta = { ...meta, ...sess.payment_intent.metadata || {} };
        }
      } else if (paymentRef && paymentRef.startsWith("pi_")) {
        const pi = await stripe.paymentIntents.retrieve(paymentRef);
        meta = pi.metadata || {};
      }
    } catch (e) {
    }
    itemCents = Number(meta.item_cents);
    feeCents = Number(meta.fee_cents);
    vatCents = Number(meta.vat_cents);
    vatRate = meta.vat_rate !== void 0 ? Number(meta.vat_rate) : 22;
    isReverseCharge = meta.reverse_charge === "1" || meta.reverse_charge === true;
    const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(auctionId));
    const auction = auctionDoc.data() || {};
    let currentPrice = amountTotalCents / 100;
    if (auction.current_price || auction.currentBid || auction.starting_price) {
      currentPrice = Number(auction.current_price || auction.currentBid || auction.starting_price);
    }
    const authoritativePriceInCents = Math.round(currentPrice * 100);
    if (isNaN(itemCents) || itemCents <= 0) {
      const computed = await computeBuyerTotals(buyerId, buyer, authoritativePriceInCents);
      itemCents = computed.itemPriceCents;
      feeCents = computed.feeCents;
      vatCents = computed.vatCents;
      vatRate = computed.vatRate;
      isReverseCharge = computed.isReverseCharge;
    }
    const expectedTotalCents = itemCents + feeCents + vatCents;
    let amountMismatch = false;
    if (expectedTotalCents !== amountTotalCents) {
      amountMismatch = true;
      console.error(`[finalizeAuctionPayment] Amount mismatch! expectedTotalCents=${expectedTotalCents}, amountTotalCents=${amountTotalCents}`, { auctionId, buyerId });
    }
    const itemPrice = itemCents / 100;
    const platformFee = feeCents / 100;
    const vatAmount = vatCents / 100;
    const amountTotal = amountTotalCents / 100;
    const currentTxSnap = await safeGetDoc(txDocRef);
    const existingTxData = currentTxSnap.data() || {};
    let salesInvoiceNo = existingTxData.sales_invoice_no;
    let commissionInvoiceNo = existingTxData.commission_invoice_no;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const holdDeadlineIso = new Date(Date.now() + 75 * 24 * 60 * 60 * 1e3).toISOString();
    const sellerStripeAccountId = seller.stripe_account_id || seller.stripeAccountId || "";
    const deliveryMethod = auction.delivery_method || "pickup";
    const autoReleaseAtIso = deliveryMethod === "pickup" ? new Date(Date.now() + PICKUP_AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1e3).toISOString() : null;
    const makeSnapshot = (user) => {
      const street = user.street_address || user.street || user.company_street || user.companyStreet || "";
      const postal = user.postal_code || user.postalCode || user.company_postal_code || user.companyPostalCode || "";
      const city = user.city || user.company_city || user.companyCity || "";
      const firstName = user.first_name || user.firstName || "";
      const lastName = user.last_name || user.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim() || user.name || user.username || user.userName || "";
      return {
        name: fullName,
        company_name: user.company_name || user.companyName || "",
        address: street,
        postal_code: postal,
        city,
        country_code: user.country_code || user.countryCode || user.country || "SI",
        tax_id: user.tax_id || user.tax_number || user.taxNumber || user.taxId || "",
        vat_id: user.vat_id || user.vatId || "",
        registration_number: user.registration_number || user.regNumber || user.registrationNumber || "",
        user_type: user.user_type || user.userType || "individual",
        vat_status: user.vat_status || user.vatStatus || (user.user_type === "business" ? "exempt_small" : "private"),
        email: user.email || ""
      };
    };
    const buyerSnapshot = makeSnapshot(buyer);
    const sellerSnapshot = makeSnapshot(seller);
    await txDocRef.set({
      amount_total: amountTotal,
      platform_fee: platformFee,
      vat_amount: vatAmount,
      vat_rate: vatRate,
      is_reverse_charge: isReverseCharge,
      item_price: itemPrice,
      status: "HELD_IN_ESCROW",
      payout_status: "held",
      seller_net_cents: itemCents,
      seller_stripe_account_id: sellerStripeAccountId,
      held_since: nowIso,
      delivery_method: deliveryMethod,
      ...deliveryMethod !== "pickup" ? { shipping_deadline: new Date(Date.now() + SHIP_DEADLINE_DAYS * 24 * 60 * 60 * 1e3).toISOString() } : {},
      auto_release_at: autoReleaseAtIso,
      hold_deadline_at: holdDeadlineIso,
      buyer_snapshot: buyerSnapshot,
      seller_snapshot: sellerSnapshot,
      ...amountMismatch ? { amount_mismatch: true } : {}
    }, { merge: true });
    await adminDb.collection("auctions").doc(auctionId).update({
      status: "completed",
      payment_status: "paid",
      post_auction_status: "paid",
      paid_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    await recordSaleCompletion(auctionId, sellerId);
    try {
      await recordAmlSpend({
        buyerId,
        amountEur: amountTotal,
        uniqueKey: "pi_" + paymentRef
      });
    } catch (spentErr) {
      console.error("Error updating buyer spending records:", spentErr.message);
    }
    try {
      const reservationDocRef = adminDb.collection("aml_reservations").doc(`${buyerId}_${auctionId}`);
      const reservationDoc = await safeGetDoc(reservationDocRef);
      if (reservationDoc.exists()) {
        await reservationDocRef.set({
          status: "consumed",
          consumed_at: (/* @__PURE__ */ new Date()).toISOString(),
          stripe_payment_intent_id: paymentRef
        }, { merge: true });
      }
    } catch (resErr) {
      console.error("[finalizeAuctionPayment] Error consuming AML reservation:", resErr.message);
    }
    if (!salesInvoiceNo || !commissionInvoiceNo) {
      try {
        salesInvoiceNo = await generateInvoiceNumber("SALES");
        commissionInvoiceNo = await generateInvoiceNumber("COMMISSION");
        await txDocRef.update({
          sales_invoice_no: salesInvoiceNo,
          commission_invoice_no: commissionInvoiceNo
        });
      } catch (e) {
        console.error("Error generating invoice numbers:", e.message);
      }
    }
    const txSnapFinal = await safeGetDoc(txDocRef);
    const transactionRecord = { id: txDocRef.id, ...txSnapFinal.data() };
    try {
      const documentsToInsert = [];
      const attachments = [];
      let auctionDataPdf = null;
      const auctionDocPdf = await safeGetDoc(adminDb.collection("auctions").doc(auctionId));
      auctionDataPdf = auctionDocPdf.data();
      let invoicePdfBuffer = null;
      try {
        invoicePdfBuffer = await generateInvoicePDF(transactionRecord, buyerSnapshot, sellerSnapshot, auctionDataPdf, salesInvoiceNo, commissionInvoiceNo);
      } catch (pdfErr) {
        if (pdfErr.message && pdfErr.message.includes("MISSING_REQUIRED_INVOICE_FIELDS")) {
          console.error("[finalizeAuctionPayment] Missing invoice fields, marking review required:", pdfErr.message);
          await txDocRef.update({
            invoice_review_required: true,
            invoice_review_reason: pdfErr.message
          });
          try {
            await adminDb.collection("admin_alerts").add({
              type: "INVOICE_REVIEW_REQUIRED",
              transaction_id: txDocRef.id,
              reason: pdfErr.message,
              created_at: (/* @__PURE__ */ new Date()).toISOString()
            });
          } catch (alertErr) {
            console.error("Failed to create admin alert for invoice review:", alertErr.message);
          }
        } else {
          throw pdfErr;
        }
      }
      if (invoicePdfBuffer) {
        const invoiceFileName = `racun_${salesInvoiceNo}.pdf`;
        const invoicePath = await uploadBufferToStorage(invoicePdfBuffer, `${buyerId}/${invoiceFileName}`);
        documentsToInsert.push({
          transaction_id: txDocRef.id,
          user_id: buyerId,
          auction_id: auctionId,
          type: "invoice",
          invoice_path: invoicePath,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        });
        attachments.push({
          filename: invoiceFileName,
          content: invoicePdfBuffer
        });
        if (documentsToInsert.length > 0) {
          const batch = adminDb.batch();
          documentsToInsert.forEach((d) => {
            const ref = adminDb.collection("documents").doc();
            batch.set(ref, d);
          });
          await batch.commit();
        }
        if (buyer.email && process.env.RESEND_API_KEY) {
          const auctionTitleText = auctionDataPdf?.title?.SLO || auctionDataPdf?.title?.EN || "Predmet dra\u017Ebe";
          const baseAppUrl = process.env.APP_URL && !process.env.APP_URL.includes("drazbenik.si") ? process.env.APP_URL : "https://drazbe.eu";
          const auctionUrl = `${baseAppUrl}/?drazba=${auctionId}`;
          const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuctionEmailTemplate, {
            type: "payment_success",
            recipientName: buyer.first_name || buyer.name || "uporabnik",
            auctionTitle: auctionTitleText,
            auctionImageUrl: auctionDataPdf?.images?.[0]?.url,
            currentPrice: transactionRecord.amount_total,
            auctionUrl,
            settingsUrl: `${baseAppUrl}/?tab=settings`
          }));
          const resendClient3 = new import_resend2.Resend(process.env.RESEND_API_KEY);
          await resendClient3.emails.send({
            from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
            to: buyer.email,
            subject: `Potrdilo o pla\u010Dilu in dokumenti: ${auctionTitleText} - dra\u017Ebenik.si`,
            html: htmlContent,
            attachments
          });
        }
        if (seller.email && process.env.RESEND_API_KEY) {
          const auctionTitleText = auctionDataPdf?.title?.SLO || auctionDataPdf?.title?.EN || "Predmet dra\u017Ebe";
          const baseAppUrl = process.env.APP_URL && !process.env.APP_URL.includes("drazbenik.si") ? process.env.APP_URL : "https://drazbe.eu";
          const auctionUrl = `${baseAppUrl}/?drazba=${auctionId}`;
          const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuctionEmailTemplate, {
            type: "payment_received_seller",
            recipientName: seller.first_name || seller.name || "prodajalec",
            auctionTitle: auctionTitleText,
            auctionImageUrl: auctionDataPdf?.images?.[0]?.url,
            currentPrice: transactionRecord.item_price,
            auctionUrl,
            settingsUrl: `${baseAppUrl}/?tab=settings`,
            paymentDeadline: "7 dni"
          }));
          const resendClient3 = new import_resend2.Resend(process.env.RESEND_API_KEY);
          await resendClient3.emails.send({
            from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
            to: seller.email,
            subject: `Novo pla\u010Dilo prejeto: ${auctionTitleText} - dra\u017Ebenik.si`,
            html: htmlContent
          });
        }
      }
    } catch (docEmailErr) {
      console.error("[finalizeAuctionPayment] Error generating docs or sending email:", docEmailErr.message);
    }
    let stripeChargeId = null;
    let stripeTransferId = null;
    let transferMissing = false;
    try {
      const stripe = getStripe();
      let piId = paymentRef;
      if (stripeSessionId && (!piId || !piId.startsWith("pi_"))) {
        const sess = await stripe.checkout.sessions.retrieve(stripeSessionId, { expand: ["payment_intent"] });
        if (sess.payment_intent) {
          piId = typeof sess.payment_intent === "string" ? sess.payment_intent : sess.payment_intent.id;
        }
      }
      if (piId && piId.startsWith("pi_")) {
        const pi = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
        const charge = pi.latest_charge;
        if (charge && typeof charge === "object") {
          stripeChargeId = charge.id;
          if (charge.transfer) {
            stripeTransferId = typeof charge.transfer === "string" ? charge.transfer : charge.transfer.id;
          }
        }
      }
    } catch (stErr) {
      console.error("[finalizeAuctionPayment] Error retrieving PaymentIntent/Charge for transfer IDs:", stErr.message);
    }
    if (!stripeTransferId) {
      console.error("[finalizeAuctionPayment] Missing transfer ID for charge:", stripeChargeId, "paymentRef:", paymentRef);
      transferMissing = true;
    }
    await txDocRef.update({
      ...stripeChargeId ? { stripe_charge_id: stripeChargeId } : {},
      ...stripeTransferId ? { stripe_transfer_id: stripeTransferId } : {},
      ...transferMissing ? { transfer_missing: true } : {},
      status: "HELD_IN_ESCROW",
      finalized: true,
      lease_until: 0
    });
    return { alreadyProcessed: false };
  } catch (err) {
    console.error("[finalizeAuctionPayment] Core error processing payment:", err);
    throw err;
  }
}
app.post("/api/webhook", import_express.default.raw({ type: "application/json" }), async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  let event = void 0;
  if (endpointSecret) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
    }
  }
  if (!event && connectSecret) {
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, connectSecret);
    } catch (err) {
    }
  }
  if (!event) {
    console.error(`Webhook Error: Signature verification failed`);
    res.status(400).send(`Webhook Error: Invalid signature`);
    return;
  }
  if (event.type === "payment_intent.succeeded" || event.type === "checkout.session.completed") {
    const isSession = event.type === "checkout.session.completed";
    const sessionObj = isSession ? event.data.object : null;
    const paymentIntent = !isSession ? event.data.object : null;
    const rawMetadata = isSession ? sessionObj?.metadata || {} : paymentIntent?.metadata || {};
    const paymentId = isSession ? typeof sessionObj?.payment_intent === "string" ? sessionObj.payment_intent : sessionObj?.payment_intent?.id || sessionObj.id : paymentIntent.id;
    console.log("Payment event succeeded:", event.type, paymentId);
    try {
      const { type, purpose, auction_id, buyer_id, seller_id, fee_percentage, user_id, package_id } = rawMetadata;
      if (purpose === "test_wallet_funding" || type === "test_wallet_funding") {
        const targetUserId = user_id || buyer_id;
        const amountCents = isSession ? sessionObj?.amount_total || 0 : paymentIntent?.amount || 0;
        const piId = isSession ? typeof sessionObj?.payment_intent === "string" ? sessionObj.payment_intent : sessionObj?.payment_intent?.id || sessionObj.id : paymentIntent.id;
        if (targetUserId && amountCents > 0 && piId) {
          console.log(`[stripe-webhook] eventId=${event.id} paymentIntentId=${piId} userId=${targetUserId} walletCredit=${amountCents}`);
          const depositResult = await creditWalletDepositFromStripe(targetUserId, amountCents, piId, {
            description: "Platform test balance funding",
            environment: "test",
            webhook_event_id: event.id,
            idempotencyKey: `wallet_dep_${piId}`
          });
          console.log(`[stripe-webhook] eventId=${event.id} paymentIntentId=${piId} userId=${targetUserId} walletCredit=${amountCents} alreadyProcessed=${depositResult.already_processed}`);
        } else {
          console.warn("[stripe-webhook] Missing user_id or amount for test_wallet_funding:", { targetUserId, amountCents, piId });
        }
        res.json({ received: true });
        return;
      }
      const isSub = type === "subscription" || isSession && (sessionObj?.amount_total === 2e3 || sessionObj?.amount_total === 5e3 || (sessionObj?.metadata?.planId || "").length > 0) || !isSession && (paymentIntent?.amount === 2e3 || paymentIntent?.amount === 5e3 || (paymentIntent?.metadata?.planId || "").length > 0);
      if (isSub) {
        let targetUserId = user_id || buyer_id || (isSession ? sessionObj?.client_reference_id : null);
        const customerEmail = isSession ? sessionObj?.customer_details?.email || sessionObj?.customer_email : paymentIntent?.receipt_email;
        if (!targetUserId && customerEmail) {
          try {
            const uSnap = await adminDb.collection("users").where("email", "==", customerEmail).limit(1).get();
            if (!uSnap.empty) {
              targetUserId = uSnap.docs[0].id;
            }
          } catch (e) {
            console.warn("[webhook] Could not resolve user by email:", e);
          }
        }
        let pkg = (package_id || rawMetadata.planId || rawMetadata.tier || "").toUpperCase();
        const amt = isSession ? sessionObj?.amount_total : paymentIntent?.amount;
        if (!pkg || !pkg.includes("PRO") && !pkg.includes("BASIC")) {
          pkg = amt === 5e3 ? "PRO" : "BASIC";
        }
        console.log("Processing subscription payment for user", targetUserId, "package:", pkg);
        if (targetUserId) {
          const now = /* @__PURE__ */ new Date();
          const validUntil = new Date(now);
          validUntil.setMonth(validUntil.getMonth() + 1);
          const updateData = {
            subscription_tier: pkg,
            subscription: pkg,
            subscription_active: true,
            subscription_paid_at: now.toISOString(),
            subscription_started_at: now.toISOString(),
            subscription_cycle_started_at: now.toISOString(),
            subscription_valid_until: validUntil.toISOString(),
            subscription_canceled: false
          };
          if (isSession && sessionObj?.subscription) {
            updateData.stripe_subscription_id = typeof sessionObj.subscription === "string" ? sessionObj.subscription : sessionObj.subscription.id;
          }
          let paymentMethodId = null;
          let customerId = null;
          if (isSession && sessionObj?.payment_intent) {
            try {
              const pi = typeof sessionObj.payment_intent === "string" ? await stripe.paymentIntents.retrieve(sessionObj.payment_intent) : sessionObj.payment_intent;
              if (typeof pi === "object" && pi.payment_method) {
                paymentMethodId = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method.id;
              }
            } catch (e) {
            }
          } else if (!isSession && paymentIntent?.payment_method) {
            paymentMethodId = typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : paymentIntent.payment_method.id;
          }
          if (isSession && sessionObj?.customer) {
            customerId = typeof sessionObj.customer === "string" ? sessionObj.customer : sessionObj.customer.id;
          } else if (!isSession && paymentIntent?.customer) {
            customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer.id;
          }
          if (paymentMethodId && customerId) {
            updateData.stripe_default_payment_method = paymentMethodId;
            updateData.stripe_customer_id = customerId;
          }
          await adminDb.collection("users").doc(targetUserId).set(updateData, { merge: true });
          const subAmt = Number(amt ? amt / 100 : pkg.includes("PRO") ? 50 : 20);
          createAndSendSubscriptionInvoice({
            userId: targetUserId,
            packageId: pkg,
            amountTotal: subAmt,
            sourceId: paymentId || `sub_${targetUserId}_${Date.now()}`,
            paymentMethod: "Spletno pla\u010Dilo / Kartica (Stripe)",
            periodStart: now,
            periodEnd: validUntil
          }).catch((e) => console.error("[webhook] Napaka pri ustvarjanju ra\u010Duna za naro\u010Dnino:", e));
        }
        res.json({ received: true });
        return;
      }
      if (!auction_id || !buyer_id || !seller_id) {
        console.warn("Missing metadata for payment:", paymentId);
        res.json({ received: true });
        return;
      }
      const amountTotalCents = isSession ? sessionObj?.amount_total || 0 : paymentIntent.amount;
      try {
        await finalizeAuctionPayment({
          auctionId: auction_id,
          buyerId: buyer_id,
          sellerId: seller_id,
          paymentRef: paymentId,
          amountTotalCents,
          stripeSessionId: isSession ? sessionObj?.id : void 0
        });
        res.json({ received: true });
        return;
      } catch (err) {
        console.error("Error processing successful payment:", err);
        res.status(500).json({ error: "processing_failed" });
        return;
      }
    } catch (err) {
      console.error("Webhook event handling error:", err);
      res.status(500).json({ error: err.message });
      return;
    }
  }
  if (event.type === "identity.verification_session.verified") {
    const session = event.data.object;
    const uid = session?.metadata?.user_id;
    if (!uid) {
      console.warn("[webhook] Missing user_id in identity.verification_session.verified metadata:", session?.id);
    } else {
      try {
        await adminDb.collection("users").doc(uid).set({
          identity_verified: true,
          identity_verified_at: (/* @__PURE__ */ new Date()).toISOString(),
          identity_verification_status: "verified"
        }, { merge: true });
        await syncPublicProfile(uid);
        console.log(`[webhook] User ${uid} identity verified successfully.`);
      } catch (err) {
        console.error(`[webhook] Error updating user ${uid} for identity verified:`, err.message);
      }
    }
  } else if (event.type === "identity.verification_session.requires_input") {
    const session = event.data.object;
    const uid = session?.metadata?.user_id;
    if (!uid) {
      console.warn("[webhook] Missing user_id in identity.verification_session.requires_input metadata:", session?.id);
    } else {
      try {
        await adminDb.collection("users").doc(uid).set({
          identity_verification_status: "requires_input",
          identity_verified: false
        }, { merge: true });
        await syncPublicProfile(uid);
        console.log(`[webhook] User ${uid} identity verification status set to requires_input.`);
      } catch (err) {
        console.error(`[webhook] Error updating user ${uid} for identity requires_input:`, err.message);
      }
    }
  } else if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const metadata = session?.metadata || {};
    const { auction_id, buyer_id } = metadata;
    const sessionId = session?.id;
    try {
      if (buyer_id && auction_id) {
        const reservationId = `${buyer_id}_${auction_id}`;
        await adminDb.collection("aml_reservations").doc(reservationId).set({
          status: "released",
          released_at: (/* @__PURE__ */ new Date()).toISOString(),
          release_reason: "checkout_session_expired"
        }, { merge: true });
        console.log(`[webhook] Released AML reservation ${reservationId} due to checkout.session.expired`);
      } else if (sessionId) {
        const qSnap = await adminDb.collection("aml_reservations").where("stripe_session_id", "==", sessionId).where("status", "==", "active").limit(5).get();
        for (const doc of qSnap.docs) {
          await doc.ref.set({
            status: "released",
            released_at: (/* @__PURE__ */ new Date()).toISOString(),
            release_reason: "checkout_session_expired"
          }, { merge: true });
          console.log(`[webhook] Released AML reservation ${doc.id} by sessionId ${sessionId}`);
        }
      } else {
        console.warn("[webhook] checkout.session.expired received without metadata or session id");
      }
    } catch (err) {
      console.error("[webhook] Error releasing AML reservation for checkout.session.expired:", err.message);
    }
  } else if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
    const paymentIntent = event.data.object;
    const metadata = paymentIntent?.metadata || {};
    const { auction_id, buyer_id } = metadata;
    const piId = paymentIntent?.id;
    try {
      if (buyer_id && auction_id) {
        const reservationId = `${buyer_id}_${auction_id}`;
        await adminDb.collection("aml_reservations").doc(reservationId).set({
          status: "released",
          released_at: (/* @__PURE__ */ new Date()).toISOString(),
          release_reason: event.type
        }, { merge: true });
        console.log(`[webhook] Released AML reservation ${reservationId} due to ${event.type}`);
      } else if (piId) {
        const qSnap = await adminDb.collection("aml_reservations").where("stripe_payment_intent_id", "==", piId).where("status", "==", "active").limit(5).get();
        for (const doc of qSnap.docs) {
          await doc.ref.set({
            status: "released",
            released_at: (/* @__PURE__ */ new Date()).toISOString(),
            release_reason: event.type
          }, { merge: true });
          console.log(`[webhook] Released AML reservation ${doc.id} by paymentIntentId ${piId}`);
        }
      } else {
        console.warn(`[webhook] ${event.type} received without metadata or payment intent id`);
      }
    } catch (err) {
      console.error(`[webhook] Error releasing AML reservation for ${event.type}:`, err.message);
    }
  } else if (event.type === "account.updated") {
    const account = event.data.object;
    const accountId = account.id;
    const isComplete = isStripeAccountReady(account);
    const requirementsDue = account.requirements?.currently_due || [];
    try {
      let targetUid = null;
      const uSnap = await adminDb.collection("users").where("stripe_account_id", "==", accountId).limit(1).get();
      if (!uSnap.empty) {
        targetUid = uSnap.docs[0].id;
      } else {
        const uSnap2 = await adminDb.collection("users").where("stripeAccountId", "==", accountId).limit(1).get();
        if (!uSnap2.empty) {
          targetUid = uSnap2.docs[0].id;
        } else if (account.metadata?.firebase_uid) {
          targetUid = account.metadata.firebase_uid;
        }
      }
      if (targetUid) {
        await adminDb.collection("users").doc(targetUid).set({
          stripe_onboarding_complete: isComplete,
          stripe_requirements_due: requirementsDue
        }, { merge: true });
        console.log(`[webhook] account.updated for user ${targetUid}: complete=${isComplete}`);
      } else {
        console.warn(`[webhook] account.updated received for ${accountId} but no user found in DB or metadata.`);
      }
    } catch (err) {
      console.error(`[webhook] Error processing account.updated for ${accountId}:`, err);
    }
    res.json({ received: true });
    return;
  }
  if (!res.headersSent) {
    res.json({ received: true });
  }
});
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    return next();
  }
  import_express.default.json({ limit: "10mb" })(req, res, (err) => {
    if (err) {
      console.warn("[JSON parse warning]:", err.message);
    }
    next();
  });
});
app.use((req, _res, next) => {
  if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
    try {
      req.body = JSON.parse(req.body);
    } catch (e) {
    }
  }
  next();
});
function requireCronSecret(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    res.status(500).json({ error: "Cron secret not configured" });
    return false;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const token = authHeader.substring(7);
  const tokenBuf = Buffer.from(token, "utf8");
  const secretBuf = Buffer.from(cronSecret, "utf8");
  if (tokenBuf.length !== secretBuf.length || !import_crypto.default.timingSafeEqual(tokenBuf, secretBuf)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
var handleCronCheck = async (req, res) => {
  if (!requireCronSecret(req, res)) return;
  try {
    console.log("[CRON] Executing auction check...");
    const results = await processAuctionCrons();
    res.json(results);
  } catch (e) {
    console.error("[CRON ERROR]", e);
    res.status(500).json({ error: e.message || "Internal server error in cron" });
  }
};
app.get("/api/cron/check-auctions", handleCronCheck);
app.post("/api/cron/check-auctions", handleCronCheck);
app.get("/api/cron-auctions", handleCronCheck);
app.post("/api/cron-auctions", handleCronCheck);
app.post("/api/place-bid", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  if (placeBidRateLimiter) {
    try {
      const { success } = await placeBidRateLimiter.limit(userId);
      if (!success) {
        return res.status(429).json({ error: "Preve\u010D oddanih ponudb. Prosimo, po\u010Dakajte." });
      }
    } catch (err) {
      console.warn("Rate limit check failed:", err);
    }
  }
  try {
    const { auction_id, amount } = req.body;
    if (!auction_id || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "Manjkajo\u010Di ali neveljavni podatki za ponudbo." });
    }
    const auctionRef = adminDb.collection("auctions").doc(auction_id);
    const userRef = adminDb.collection("users").doc(userId);
    const privateRef = adminDb.collection("auctions_private").doc(auction_id);
    const myBidRef = adminDb.collection("users").doc(userId).collection("my_bids").doc(auction_id);
    const userSnap = await safeGetDoc(userRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: "Uporabnik ne obstaja." });
    }
    const userData = userSnap.data();
    if (userData.isBlocked) {
      return res.status(403).json({ error: "Va\u0161 ra\u010Dun je za\u010Dasno blokiran." });
    }
    try {
      await assertVerifiedUser(userId, userData);
    } catch (verErr) {
      return res.status(403).json({ error: verErr.message, code: verErr.code });
    }
    let outbidUserToNotify = null;
    let finalWinnerId = userId;
    let finalPrice = amount;
    let finalMyMax = amount;
    await adminDb.runTransaction(async (transaction) => {
      const auctionDoc = await transaction.get(auctionRef);
      if (!isDocSnapshotExists(auctionDoc)) {
        throw new Error("Dra\u017Eba ne obstaja.");
      }
      const data = getDocSnapshotData(auctionDoc) || {};
      const privateDoc = await transaction.get(privateRef);
      const privData = isDocSnapshotExists(privateDoc) ? getDocSnapshotData(privateDoc) || {} : {};
      const myBidDoc = await transaction.get(myBidRef);
      const myBidData = isDocSnapshotExists(myBidDoc) ? getDocSnapshotData(myBidDoc) || {} : {};
      const auctionStatus = data.status || "active";
      const rawEndTime = data.end_time || data.endTime;
      const parsedEndTime = rawEndTime ? new Date(rawEndTime).getTime() : 0;
      if (auctionStatus !== "active" || parsedEndTime > 0 && parsedEndTime <= Date.now()) {
        throw new Error("Dra\u017Eba ni ve\u010D aktivna ali pa je \u017Ee potekla.");
      }
      if (data.seller_id === userId || data.sellerId === userId) {
        throw new Error("Ne morete oddati ponudbe na lastno dra\u017Ebo.");
      }
      const currentPrice = Number(data.current_price ?? data.currentBid ?? 0);
      const prevWinnerId = data.winner_id || data.winnerId;
      const isCurrentWinner = prevWinnerId === userId;
      if (amount <= currentPrice) {
        throw new Error("Ponudba mora biti vi\u0161ja od trenutne cene.");
      }
      const currentProxy = privData.current_proxy_bid || data.current_proxy_bid || data.currentProxyBid;
      let newCurrentPrice = currentPrice;
      let newWinnerId = userId;
      let newProxyBid = { user_id: userId, amount };
      const increment = getBidIncrement(currentPrice);
      if (currentProxy && currentProxy.user_id !== userId) {
        if (amount > currentProxy.amount) {
          newCurrentPrice = Math.min(amount, currentProxy.amount + increment);
          newWinnerId = userId;
          newProxyBid = { user_id: userId, amount };
        } else if (amount === currentProxy.amount) {
          newCurrentPrice = amount;
          newWinnerId = currentProxy.user_id;
          newProxyBid = currentProxy;
        } else {
          newCurrentPrice = Math.min(currentProxy.amount, amount + increment);
          newWinnerId = currentProxy.user_id;
          newProxyBid = currentProxy;
        }
      } else if (isCurrentWinner || currentProxy && currentProxy.user_id === userId) {
        newCurrentPrice = currentPrice;
        newWinnerId = userId;
        newProxyBid = { user_id: userId, amount };
      } else {
        newCurrentPrice = Math.min(amount, currentPrice + increment);
        newWinnerId = userId;
        newProxyBid = { user_id: userId, amount };
      }
      const endTimeStr = data.end_time || data.endTime;
      const endTime = endTimeStr ? new Date(endTimeStr).getTime() : 0;
      const now = Date.now();
      let newEndTimeStr = endTimeStr;
      if (endTime > now && endTime - now < 60 * 1e3) {
        newEndTimeStr = new Date(now + 60 * 1e3).toISOString();
      }
      let topBids = Array.isArray(privData.top_bids) && privData.top_bids.length > 0 ? [...privData.top_bids] : Array.isArray(data.top_bids) ? [...data.top_bids] : [];
      topBids.push({ user_id: userId, amount, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      topBids.sort((a, b) => b.amount - a.amount);
      let uniqueTopBids = [];
      let seenUsers = /* @__PURE__ */ new Set();
      for (let bid of topBids) {
        if (!seenUsers.has(bid.user_id)) {
          uniqueTopBids.push(bid);
          seenUsers.add(bid.user_id);
        }
      }
      uniqueTopBids = uniqueTopBids.slice(0, 3);
      const existingBidderIds = Array.isArray(privData.bidder_ids) ? privData.bidder_ids : [];
      const distinctBidders = /* @__PURE__ */ new Set([...existingBidderIds, userId, ...uniqueTopBids.map((b) => b.user_id)]);
      const hasSecondBidder = distinctBidders.size >= 2;
      const previousMyMax = Number(myBidData.my_max) || 0;
      const calculatedMyMax = Math.max(previousMyMax, amount);
      finalMyMax = calculatedMyMax;
      const publicBidPrice = newWinnerId === userId ? newCurrentPrice : amount;
      const maskedAlias = maskUsername(userData.username || userData.first_name || userData.email?.split("@")[0]);
      const bidSubDocRef = adminDb.collection("auctions").doc(auction_id).collection("bids").doc();
      transaction.update(auctionRef, {
        current_price: newCurrentPrice,
        currentBid: newCurrentPrice,
        winner_id: newWinnerId,
        winnerId: newWinnerId,
        bid_count: (data.bid_count || data.bidCount || 0) + 1,
        bidCount: (data.bid_count || data.bidCount || 0) + 1,
        has_second_bidder: hasSecondBidder,
        end_time: newEndTimeStr,
        endTime: newEndTimeStr,
        bidding_history: import_firestore.FieldValue.delete(),
        biddingHistory: import_firestore.FieldValue.delete(),
        top_bids: import_firestore.FieldValue.delete(),
        current_proxy_bid: import_firestore.FieldValue.delete(),
        currentProxyBid: import_firestore.FieldValue.delete(),
        hidden_max_bid: import_firestore.FieldValue.delete(),
        hiddenMaxBid: import_firestore.FieldValue.delete()
      });
      transaction.set(privateRef, {
        current_proxy_bid: newProxyBid,
        top_bids: uniqueTopBids,
        bidder_ids: import_firestore.FieldValue.arrayUnion(userId)
      }, { merge: true });
      transaction.set(bidSubDocRef, {
        bidder_alias: maskedAlias,
        price: publicBidPrice,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      transaction.set(myBidRef, {
        auction_id,
        my_max: calculatedMyMax,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true });
      finalWinnerId = newWinnerId;
      finalPrice = newCurrentPrice;
      if (prevWinnerId && prevWinnerId !== userId && newWinnerId === userId) {
        const title = data.title?.SLO || data.title?.EN || (typeof data.title === "string" ? data.title : "Predmet dra\u017Ebe");
        const imageUrl = Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : void 0;
        outbidUserToNotify = {
          userId: prevWinnerId,
          newPrice: newCurrentPrice,
          auctionTitle: title,
          auctionImageUrl: imageUrl
        };
      }
    });
    if (outbidUserToNotify) {
      (async () => {
        try {
          const prevUserDoc = await safeGetDoc(adminDb.collection("users").doc(outbidUserToNotify.userId));
          if (prevUserDoc.exists()) {
            const prevUserData = prevUserDoc.data();
            if (prevUserData.email) {
              await sendOutbidNotification({
                toEmail: prevUserData.email,
                recipientName: prevUserData.first_name || prevUserData.name || "Uporabnik",
                auctionId: auction_id,
                auctionTitle: outbidUserToNotify.auctionTitle,
                auctionImageUrl: outbidUserToNotify.auctionImageUrl,
                newPrice: outbidUserToNotify.newPrice
              });
            }
          }
        } catch (emailErr) {
          console.error("[OUTBID EMAIL ERROR]", emailErr.message);
        }
      })();
    }
    const resultStatus = finalWinnerId === userId ? "ok" : "outbid";
    res.json({
      success: true,
      resultStatus,
      newWinnerId: finalWinnerId,
      currentPrice: finalPrice,
      my_max: finalMyMax
    });
  } catch (e) {
    console.error("[PLACE BID ERROR]", e);
    res.status(400).json({ error: e.message || "Napaka pri oddaji ponudbe" });
  }
});
app.post("/api/notify-outbid", async (req, res) => {
  try {
    const { auction_id, outbid_user_id, new_price } = req.body;
    if (!auction_id || !outbid_user_id) {
      return res.status(400).json({ error: "Manjkajo\u010Di podatki" });
    }
    const [auctionDoc, userDoc] = await Promise.all([
      safeGetDoc(adminDb.collection("auctions").doc(auction_id)),
      safeGetDoc(adminDb.collection("users").doc(outbid_user_id))
    ]);
    if (!auctionDoc.exists() || !userDoc.exists()) {
      return res.status(404).json({ error: "Dra\u017Eba ali uporabnik ne obstaja" });
    }
    const auctionData = auctionDoc.data();
    const userData = userDoc.data();
    if (!userData.email) {
      return res.json({ success: false, reason: "No email on user" });
    }
    const title = auctionData.title?.SLO || auctionData.title?.EN || (typeof auctionData.title === "string" ? auctionData.title : "Predmet dra\u017Ebe");
    const imageUrl = Array.isArray(auctionData.images) && auctionData.images.length > 0 ? auctionData.images[0] : void 0;
    const price = typeof new_price === "number" ? new_price : Number(auctionData.current_price || 0);
    await sendOutbidNotification({
      toEmail: userData.email,
      recipientName: userData.first_name || userData.name || "Uporabnik",
      auctionId: auction_id,
      auctionTitle: title,
      auctionImageUrl: imageUrl,
      newPrice: price
    });
    res.json({ success: true });
  } catch (e) {
    console.error("[NOTIFY OUTBID ERROR]", e);
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/fees/preview", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    if (placeBidRateLimiter) {
      try {
        const { success } = await placeBidRateLimiter.limit(userId);
        if (!success) {
          return res.status(429).json({ error: "Preve\u010D zahtev. Poskusite znova kasneje." });
        }
      } catch (e) {
      }
    }
    const { amount, auction_id } = req.body || {};
    let itemPriceCents = 0;
    if (auction_id) {
      const aDoc = await safeGetDoc(adminDb.collection("auctions").doc(auction_id));
      if (!aDoc.exists) {
        return res.status(404).json({ error: "Dra\u017Eba ni najdena" });
      }
      const aData = aDoc.data() || {};
      const winnerId = aData.winner_id || aData.winnerId;
      const secondWinnerId = aData.second_winner_id || aData.secondWinnerId;
      if (winnerId !== userId && secondWinnerId !== userId) {
        return res.status(403).json({ error: "Nimate pravic za pregled te dra\u017Ebe." });
      }
      itemPriceCents = parseAmountToCents(aData.current_price || aData.currentBid || aData.starting_price || 0);
    } else {
      itemPriceCents = parseAmountToCents(amount);
      if (itemPriceCents <= 0 || itemPriceCents > 1e8) {
        return res.status(400).json({ error: "Neveljaven znesek." });
      }
    }
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(userId));
    const userData = userDoc.exists ? userDoc.data() || {} : {};
    const result = await computeBuyerTotals(userId, userData, itemPriceCents);
    return res.json(result);
  } catch (err) {
    console.error("[fees/preview]", err);
    return res.status(500).json({ error: "Izra\u010Duna provizije ni bilo mogo\u010De pridobiti." });
  }
});
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.post("/api/create-checkout-session", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  if (checkoutPaymentRateLimiter) {
    try {
      const { success } = await checkoutPaymentRateLimiter.limit(userId);
      if (!success) {
        return res.status(429).json({ error: "Preve\u010D pla\u010Dilnih zahtev. Prosimo, po\u010Dakajte." });
      }
    } catch (err) {
      console.warn("Rate limit check failed:", err);
    }
  }
  try {
    const { currency = "eur", auction_id, auctionId, return_url, type = "auction", package_id, planId, tier } = req.body || {};
    const stripe = getStripe();
    const effectiveAuctionId = auction_id || auctionId;
    if (effectiveAuctionId) {
      await finalizeAuction(effectiveAuctionId);
    }
    const effectiveBuyerId = userId;
    let auctionTitle = "Pla\u010Dilo";
    let sessionMetadata = { type };
    let buyer = null;
    let stripeCustomerId = null;
    let finalAmountCents = 0;
    let reservationId = "";
    let reservationCreated = false;
    try {
      const buyerDoc = await safeGetDoc(adminDb.collection("users").doc(effectiveBuyerId));
      if (buyerDoc.exists()) {
        buyer = buyerDoc.data();
      }
    } catch (e) {
      console.warn("Could not fetch buyer from DB:", e.message);
    }
    if (buyer) {
      stripeCustomerId = await getOrCreateStripeCustomer(stripe, effectiveBuyerId, buyer);
    }
    if (type === "auction") {
      if (buyer?.isBlocked) {
        return res.status(403).json({ error: "Va\u0161 ra\u010Dun je za\u010Dasno blokiran." });
      }
      try {
        await assertVerifiedUser(effectiveBuyerId, buyer);
      } catch (verErr) {
        return res.status(403).json({ error: verErr.message, code: verErr.code });
      }
      if (!effectiveAuctionId) {
        return res.status(400).json({ error: "Missing required auction fields for payment" });
      }
      let auction = null;
      try {
        const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(effectiveAuctionId));
        if (auctionDoc.exists()) {
          auction = auctionDoc.data();
        }
      } catch (e) {
        console.warn("Could not fetch auction:", e);
      }
      if (!auction) {
        return res.status(400).json({ error: "Invalid auction payment amount (auction not found)" });
      }
      if (auction.payment_status === "paid") {
        return res.status(400).json({ error: "Ta dra\u017Eba je \u017Ee pla\u010Dana." });
      }
      const winnerId = auction.winner_id || auction.winnerId || auction.highest_bidder;
      const isCaseA = auction.post_auction_status === "awaiting_payment_1st" && winnerId === userId;
      const isCaseB = auction.post_auction_status === "offered_2nd" && auction.second_winner_id === userId;
      if (!isCaseA && !isCaseB) {
        return res.status(403).json({ error: "Te dra\u017Ebe ne morete pla\u010Dati." });
      }
      if (auction.title) {
        auctionTitle = (typeof auction.title === "object" ? auction.title["SLO"] || auction.title["EN"] : auction.title) || "Dra\u017Eba";
      }
      let authoritativePriceInCents = 0;
      if (auction.current_price !== void 0 && auction.current_price !== null && auction.current_price !== "") {
        authoritativePriceInCents = parseAmountToCents(auction.current_price);
      } else if (auction.currentBid !== void 0 && auction.currentBid !== null && auction.currentBid !== "") {
        authoritativePriceInCents = parseAmountToCents(auction.currentBid);
      } else if (auction.starting_price !== void 0 && auction.starting_price !== null && auction.starting_price !== "") {
        authoritativePriceInCents = parseAmountToCents(auction.starting_price);
      }
      if (authoritativePriceInCents <= 0) {
        return res.status(400).json({ error: "Invalid auction payment amount" });
      }
      const effectiveSellerId = auction.seller_id || auction.sellerId || "";
      const buyerTotals = await computeBuyerTotals(userId, buyer, authoritativePriceInCents);
      finalAmountCents = buyerTotals.totalCents;
      let sellerAccountId = "";
      try {
        sellerAccountId = await getSellerPayoutAccount(effectiveSellerId);
      } catch (payoutErr) {
        if (payoutErr.code === "SELLER_PAYOUTS_NOT_READY") {
          return res.status(409).json({
            error: "Prodajalec \u0161e nima urejenih izpla\u010Dil. Pla\u010Dilo trenutno ni mogo\u010De.",
            code: "SELLER_PAYOUTS_NOT_READY"
          });
        }
        throw payoutErr;
      }
      reservationId = `${userId}_${effectiveAuctionId}`;
      reservationCreated = false;
      try {
        await reserveAmlAmount({
          buyerId: userId,
          auctionId: effectiveAuctionId,
          amountEur: finalAmountCents / 100
        });
        reservationCreated = true;
      } catch (amlErr) {
        return res.status(amlErr.statusCode || 400).json({ error: amlErr.message });
      }
      req._sellerAccountId = sellerAccountId;
      req._buyerTotals = buyerTotals;
      req._auctionId = effectiveAuctionId;
      sessionMetadata = {
        type: "auction",
        auction_id: effectiveAuctionId,
        buyer_id: userId,
        seller_id: effectiveSellerId,
        item_cents: String(buyerTotals.itemPriceCents),
        fee_cents: String(buyerTotals.feeCents),
        vat_cents: String(buyerTotals.vatCents),
        vat_rate: String(buyerTotals.vatRate),
        reverse_charge: buyerTotals.isReverseCharge ? "1" : "0",
        tier: buyerTotals.tier
      };
      const lineItems = [];
      if (buyerTotals.itemPriceCents > 0) {
        lineItems.push({
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: auctionTitle },
            unit_amount: buyerTotals.itemPriceCents
          },
          quantity: 1
        });
      }
      if (buyerTotals.feeCents > 0) {
        const feePercentStr = String(buyerTotals.feePercent).replace(".", ",");
        lineItems.push({
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: `Provizija platforme (${feePercentStr} %)` },
            unit_amount: buyerTotals.feeCents
          },
          quantity: 1
        });
      }
      if (buyerTotals.vatCents > 0) {
        lineItems.push({
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: `DDV ${buyerTotals.vatRate} % na provizijo` },
            unit_amount: buyerTotals.vatCents
          },
          quantity: 1
        });
      }
      req._auctionLineItems = lineItems;
    } else if (type === "subscription") {
      const rawPlan = package_id || planId || tier;
      if (!rawPlan || typeof rawPlan !== "string") {
        return res.status(400).json({ error: "Neveljaven paket naro\u010Dnine." });
      }
      const cleanPlan = rawPlan.trim().toUpperCase();
      if (cleanPlan !== "BASIC" && cleanPlan !== "PRO") {
        return res.status(400).json({ error: "Neveljaven paket naro\u010Dnine." });
      }
      if (cleanPlan === "PRO") {
        finalAmountCents = 5e3;
      } else {
        finalAmountCents = 2e3;
      }
      auctionTitle = "Naro\u010Dnina - " + (cleanPlan === "PRO" ? "Napredni (Pro)" : "Osnovni (Basic)");
      sessionMetadata = {
        type: "subscription",
        buyer_id: userId,
        user_id: userId,
        planId: cleanPlan.toLowerCase(),
        package_id: cleanPlan,
        tier: cleanPlan,
        amount: finalAmountCents.toString()
      };
    } else {
      return res.status(400).json({ error: "Neveljavna vrsta pla\u010Dila." });
    }
    if (finalAmountCents <= 0) {
      return res.status(400).json({ error: "Invalid auction payment amount" });
    }
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : defaultAllowedOrigins;
    let safeBaseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, "") : "https://www.drazbe.eu";
    if (return_url && typeof return_url === "string") {
      try {
        const parsed = new URL(return_url);
        if (allowedOrigins.includes(parsed.origin)) {
          safeBaseUrl = return_url;
        }
      } catch (_) {
      }
    }
    const successUrl = safeBaseUrl.includes("/stripe-callback.html") ? `${safeBaseUrl}${safeBaseUrl.includes("?") ? "&" : "?"}payment=success&type=${type}&session_id={CHECKOUT_SESSION_ID}` : `${safeBaseUrl}${safeBaseUrl.includes("?") ? "&" : "?"}payment=success&type=${type}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = safeBaseUrl.includes("/stripe-callback.html") ? `${safeBaseUrl}${safeBaseUrl.includes("?") ? "&" : "?"}payment=cancel` : `${safeBaseUrl}${safeBaseUrl.includes("?") ? "&" : "?"}payment=cancel`;
    const sessionParams = {
      payment_method_types: ["card"],
      line_items: type === "auction" && req._auctionLineItems && req._auctionLineItems.length > 0 ? req._auctionLineItems : [{
        price_data: {
          currency,
          product_data: {
            name: auctionTitle
          },
          unit_amount: finalAmountCents
        },
        quantity: 1
      }],
      metadata: sessionMetadata,
      payment_intent_data: {
        metadata: sessionMetadata,
        ...type === "auction" && req._sellerAccountId ? {
          application_fee_amount: req._buyerTotals.feeCents + req._buyerTotals.vatCents,
          transfer_data: { destination: req._sellerAccountId },
          transfer_group: "auction_" + req._auctionId
        } : {},
        ...type === "subscription" ? { setup_future_usage: "off_session" } : {}
      },
      mode: "payment",
      expires_at: Math.floor(Date.now() / 1e3) + 1800,
      success_url: successUrl,
      cancel_url: cancelUrl
    };
    if (effectiveBuyerId) {
      sessionParams.client_reference_id = effectiveBuyerId;
    }
    if (stripeCustomerId) {
      sessionParams.customer = stripeCustomerId;
      sessionParams.customer_update = {
        address: "auto",
        name: "auto",
        shipping: "auto"
      };
    } else if (buyer?.email) {
      sessionParams.customer_email = buyer.email;
    }
    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeErr) {
      if (reservationCreated) {
        try {
          await adminDb.collection("aml_reservations").doc(reservationId).set({
            status: "released",
            released_at: (/* @__PURE__ */ new Date()).toISOString(),
            release_reason: "stripe_checkout_create_failed"
          }, { merge: true });
        } catch (rErr) {
          console.error("Error releasing reservation on Stripe checkout failure:", rErr.message);
        }
      }
      throw stripeErr;
    }
    if (reservationCreated) {
      try {
        await adminDb.collection("aml_reservations").doc(reservationId).set({
          stripe_session_id: session.id
        }, { merge: true });
      } catch (rErr) {
        console.error("Error updating reservation with stripe_session_id:", rErr.message);
      }
    }
    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});
app.post("/api/confirm-checkout-session", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const { sessionId, auctionId } = req.body || {};
    const stripe = getStripe();
    if (!sessionId && !auctionId) {
      return res.status(400).json({ error: "Missing sessionId or auctionId" });
    }
    let session = null;
    let paymentIntent = null;
    if (sessionId) {
      try {
        session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["payment_intent"]
        });
      } catch (err) {
        console.error("Error retrieving checkout session:", err);
      }
    }
    if (session) {
      const isPaid = session.payment_status === "paid" || session.status === "complete";
      if (!isPaid) {
        return res.status(400).json({ error: "Payment not completed for this session", status: session.status });
      }
      paymentIntent = typeof session.payment_intent === "object" ? session.payment_intent : null;
      const metadata = session.metadata || (paymentIntent ? paymentIntent.metadata : {}) || {};
      const sessionUserId = metadata.buyer_id || metadata.user_id;
      if (sessionUserId && sessionUserId !== userId) {
        return res.status(403).json({ error: "Forbidden: Session belongs to another user" });
      }
      const type = metadata.type || "auction";
      const effectiveAuctionId = metadata.auction_id || auctionId;
      const effectiveBuyerId = userId;
      let effectiveSellerId = metadata.seller_id;
      const isSub = type === "subscription" || session.amount_total === 2e3 || session.amount_total === 5e3 || (metadata.planId || "").length > 0;
      if (isSub) {
        let targetUserId = userId;
        if (!targetUserId) {
          const customerEmail = session.customer_details?.email || session.customer_email || paymentIntent?.receipt_email;
          if (customerEmail) {
            try {
              const uSnap = await adminDb.collection("users").where("email", "==", customerEmail).limit(1).get();
              if (!uSnap.empty) {
                targetUserId = uSnap.docs[0].id;
              }
            } catch (e) {
              console.warn("[confirm-checkout-session] Could not find user by email:", e);
            }
          }
        }
        let packageId = (metadata.package_id || metadata.tier || metadata.planId || "").toUpperCase();
        if (!packageId || !packageId.includes("PRO") && !packageId.includes("BASIC")) {
          packageId = session.amount_total === 5e3 ? "PRO" : "BASIC";
        }
        if (targetUserId) {
          const now = /* @__PURE__ */ new Date();
          const validUntil = new Date(now);
          validUntil.setMonth(validUntil.getMonth() + 1);
          const updateData = {
            subscription_tier: packageId,
            subscription: packageId,
            subscription_active: true,
            subscription_paid_at: now.toISOString(),
            subscription_started_at: now.toISOString(),
            subscription_cycle_started_at: now.toISOString(),
            subscription_valid_until: validUntil.toISOString(),
            subscription_canceled: false,
            stripe_checkout_session_id: session.id
          };
          if (session?.subscription) {
            updateData.stripe_subscription_id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          }
          if (session?.customer) {
            updateData.stripe_customer_id = typeof session.customer === "string" ? session.customer : session.customer.id;
          }
          await adminDb.collection("users").doc(targetUserId).set(updateData, { merge: true });
          console.log(`[confirm-checkout-session] Successfully upgraded user ${targetUserId} to ${packageId}`);
          const subAmt = Number(session.amount_total ? session.amount_total / 100 : packageId.includes("PRO") ? 50 : 20);
          createAndSendSubscriptionInvoice({
            userId: targetUserId,
            packageId,
            amountTotal: subAmt,
            sourceId: session.id,
            paymentMethod: "Spletno pla\u010Dilo / Kartica (Stripe)",
            periodStart: now,
            periodEnd: validUntil
          }).catch((e) => console.error("[confirm-checkout-session] Napaka pri ustvarjanju ra\u010Duna za naro\u010Dnino:", e));
        }
        return res.json({ success: true, type: "subscription", package_id: packageId, userId: targetUserId });
      }
      if (effectiveAuctionId) {
        if (!effectiveSellerId) {
          try {
            const aDoc = await safeGetDoc(adminDb.collection("auctions").doc(effectiveAuctionId));
            if (aDoc.exists()) {
              const aData = aDoc.data() || {};
              effectiveSellerId = aData.seller_id || aData.sellerId;
            }
          } catch (e) {
          }
        }
        if (!effectiveSellerId) {
          return res.status(400).json({ error: "Missing seller ID for auction payment" });
        }
        const paymentRef = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || paymentIntent?.id || session.id;
        const amountTotalCents = session.amount_total || (paymentIntent ? paymentIntent.amount : 0);
        try {
          await finalizeAuctionPayment({
            auctionId: effectiveAuctionId,
            buyerId: effectiveBuyerId,
            sellerId: effectiveSellerId,
            paymentRef,
            amountTotalCents,
            stripeSessionId: session.id
          });
        } catch (err) {
          console.error("[confirm-checkout-session] finalizeAuctionPayment error:", err);
          return res.status(500).json({ error: "processing_failed" });
        }
        return res.json({ success: true, paid: true, auction_id: effectiveAuctionId });
      }
      return res.status(400).json({ error: "Seja pla\u010Dila nima podatkov o dra\u017Ebi." });
    } else {
      return res.status(400).json({ error: "Manjka identifikator seje pla\u010Dila." });
    }
  } catch (err) {
    console.error("Error in confirm-checkout-session:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/create-payment-intent", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  if (checkoutPaymentRateLimiter) {
    try {
      const { success } = await checkoutPaymentRateLimiter.limit(userId);
      if (!success) {
        return res.status(429).json({ error: "Preve\u010D pla\u010Dilnih zahtev. Prosimo, po\u010Dakajte." });
      }
    } catch (err) {
      console.warn("Rate limit check failed:", err);
    }
  }
  try {
    const { currency = "eur", auction_id, auctionId } = req.body || {};
    const stripe = getStripe();
    const effectiveAuctionId = auction_id || auctionId;
    if (effectiveAuctionId) {
      await finalizeAuction(effectiveAuctionId);
    }
    if (!effectiveAuctionId) {
      return res.status(400).json({ error: "Missing required auction fields for payment" });
    }
    let stripeCustomerId = null;
    let buyer = null;
    const buyerDoc = await safeGetDoc(adminDb.collection("users").doc(userId));
    if (buyerDoc.exists()) {
      buyer = buyerDoc.data();
      stripeCustomerId = await getOrCreateStripeCustomer(stripe, userId, buyer);
    }
    if (buyer?.isBlocked) {
      return res.status(403).json({ error: "Va\u0161 ra\u010Dun je za\u010Dasno blokiran." });
    }
    try {
      await assertVerifiedUser(userId, buyer);
    } catch (verErr) {
      return res.status(403).json({ error: verErr.message, code: verErr.code });
    }
    const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(effectiveAuctionId));
    if (!auctionDoc.exists()) {
      return res.status(400).json({ error: "Invalid auction payment amount (auction not found)" });
    }
    const auction = auctionDoc.data() || {};
    if (auction.payment_status === "paid") {
      return res.status(400).json({ error: "Ta dra\u017Eba je \u017Ee pla\u010Dana." });
    }
    const winnerId = auction.winner_id || auction.winnerId || auction.highest_bidder;
    const isCaseA = auction.post_auction_status === "awaiting_payment_1st" && winnerId === userId;
    const isCaseB = auction.post_auction_status === "offered_2nd" && auction.second_winner_id === userId;
    if (!isCaseA && !isCaseB) {
      return res.status(403).json({ error: "Te dra\u017Ebe ne morete pla\u010Dati." });
    }
    let authoritativePriceInCents = 0;
    if (auction.current_price !== void 0 && auction.current_price !== null && auction.current_price !== "") {
      authoritativePriceInCents = parseAmountToCents(auction.current_price);
    } else if (auction.currentBid !== void 0 && auction.currentBid !== null && auction.currentBid !== "") {
      authoritativePriceInCents = parseAmountToCents(auction.currentBid);
    } else if (auction.starting_price !== void 0 && auction.starting_price !== null && auction.starting_price !== "") {
      authoritativePriceInCents = parseAmountToCents(auction.starting_price);
    }
    if (authoritativePriceInCents <= 0) {
      return res.status(400).json({ error: "Invalid auction payment amount" });
    }
    const effectiveSellerId = auction.seller_id || auction.sellerId || "";
    const buyerTotals = await computeBuyerTotals(userId, buyer, authoritativePriceInCents);
    const finalAmountCents = buyerTotals.totalCents;
    let sellerAccountId = "";
    try {
      sellerAccountId = await getSellerPayoutAccount(effectiveSellerId);
    } catch (payoutErr) {
      if (payoutErr.code === "SELLER_PAYOUTS_NOT_READY") {
        return res.status(409).json({
          error: "Prodajalec \u0161e nima urejenih izpla\u010Dil. Pla\u010Dilo trenutno ni mogo\u010De.",
          code: "SELLER_PAYOUTS_NOT_READY"
        });
      }
      throw payoutErr;
    }
    const reservationId = `${userId}_${effectiveAuctionId}`;
    let reservationCreated = false;
    try {
      await reserveAmlAmount({
        buyerId: userId,
        auctionId: effectiveAuctionId,
        amountEur: finalAmountCents / 100
      });
      reservationCreated = true;
    } catch (amlErr) {
      return res.status(amlErr.statusCode || 400).json({ error: amlErr.message });
    }
    if (finalAmountCents <= 0) {
      return res.status(400).json({ error: "Invalid payment intent amount" });
    }
    const intentParams = {
      amount: finalAmountCents,
      currency,
      automatic_payment_methods: {
        enabled: true
      },
      application_fee_amount: buyerTotals.feeCents + buyerTotals.vatCents,
      transfer_data: { destination: sellerAccountId },
      transfer_group: "auction_" + effectiveAuctionId,
      metadata: {
        type: "auction",
        auction_id: effectiveAuctionId,
        buyer_id: userId,
        seller_id: effectiveSellerId,
        item_cents: String(buyerTotals.itemPriceCents),
        fee_cents: String(buyerTotals.feeCents),
        vat_cents: String(buyerTotals.vatCents),
        vat_rate: String(buyerTotals.vatRate),
        reverse_charge: buyerTotals.isReverseCharge ? "1" : "0",
        tier: buyerTotals.tier
      }
    };
    if (stripeCustomerId) {
      intentParams.customer = stripeCustomerId;
    }
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(intentParams);
    } catch (stripeErr) {
      if (reservationCreated) {
        try {
          await adminDb.collection("aml_reservations").doc(reservationId).set({
            status: "released",
            released_at: (/* @__PURE__ */ new Date()).toISOString(),
            release_reason: "stripe_payment_intent_create_failed"
          }, { merge: true });
        } catch (rErr) {
          console.error("Error releasing reservation on Stripe payment intent failure:", rErr.message);
        }
      }
      throw stripeErr;
    }
    if (reservationCreated) {
      try {
        await adminDb.collection("aml_reservations").doc(reservationId).set({
          stripe_payment_intent_id: paymentIntent.id
        }, { merge: true });
      } catch (rErr) {
        console.error("Error updating reservation with stripe_payment_intent_id:", rErr.message);
      }
    }
    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error("Stripe Payment Intent Error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});
app.post("/api/stripe-account-session", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(userId));
    const userData = userDoc.exists ? userDoc.data() || {} : {};
    if (userData.isBlocked) {
      return res.status(403).json({ error: "Va\u0161 ra\u010Dun je za\u010Dasno blokiran." });
    }
    try {
      await assertVerifiedUser(userId, userData);
    } catch (verErr) {
      return res.status(403).json({ error: verErr.message, code: verErr.code });
    }
    const accountId = await ensureSellerStripeAccount(userId, userData);
    const stripe = getStripe();
    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: {
          enabled: true,
          features: { external_account_collection: true }
        }
      }
    });
    return res.status(200).json({ client_secret: accountSession.client_secret });
  } catch (error) {
    console.error("Stripe Account Session Error:", error);
    return res.status(500).json({ error: error.message || "Error creating account session" });
  }
});
app.post("/api/stripe-account-link", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const { return_url, refresh_url } = req.body || {};
    const targetUserId = userId;
    const stripe = getStripe();
    const userDocRef = adminDb.collection("users").doc(targetUserId);
    const userDoc = await safeGetDoc(userDocRef);
    const user = userDoc.data() || {};
    const targetStripeAccountId = await ensureSellerStripeAccount(targetUserId, user);
    if (user.stripe_onboarding_complete) {
      try {
        const loginLink = await stripe.accounts.createLoginLink(targetStripeAccountId);
        return res.json({ url: loginLink.url });
      } catch (e) {
        console.warn("Failed to create login link:", e.message);
      }
    }
    const reqOrigin = req.get("origin") || (req.get("host") ? `${req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http"}://${req.get("host")}` : "https://www.drazbe.eu");
    const accountLink = await stripe.accountLinks.create({
      account: targetStripeAccountId,
      refresh_url: refresh_url || `${reqOrigin}/stripe-callback.html?stripe=refresh`,
      return_url: return_url || `${reqOrigin}/stripe-callback.html?stripe=success`,
      type: "account_onboarding"
    });
    return res.json({ url: accountLink.url });
  } catch (error) {
    console.error("Stripe Account Link Error:", error);
    return res.status(500).json({ error: error.message || "Stripe configuration error" });
  }
});
app.post("/api/stripe-check-account-status", async (req, res) => {
  try {
    let userId;
    try {
      userId = await authenticateFirebaseUser(req);
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || "Unauthorized" });
    }
    const stripe = getStripe();
    const userDocRef = adminDb.collection("users").doc(userId);
    const userDoc = await safeGetDoc(userDocRef);
    const user = userDoc.data() || {};
    let targetStripeAccountId = user.stripeAccountId || user.stripe_account_id;
    if (!targetStripeAccountId) {
      return res.json({ complete: false, requirements_due: [] });
    }
    const account = await stripe.accounts.retrieve(targetStripeAccountId);
    const isComplete = isStripeAccountReady(account);
    const requirementsDue = account.requirements?.currently_due || [];
    await userDocRef.set({
      stripe_onboarding_complete: isComplete,
      stripe_requirements_due: requirementsDue
    }, { merge: true });
    return res.json({ complete: isComplete, requirements_due: requirementsDue });
  } catch (error) {
    console.error("Stripe Check Account Status Error:", error);
    return res.status(500).json({ error: error.message || "Server configuration error" });
  }
});
app.post("/api/payments/wallet-pay-auction", async (req, res) => {
  return res.status(410).json({ error: "Pla\u010Dilo z denarnico ni ve\u010D na voljo. Uporabite kartico." });
});
app.post("/api/payments/wallet-pay-subscription", async (req, res) => {
  return res.status(410).json({ error: "Pla\u010Dilo z denarnico ni ve\u010D na voljo. Uporabite kartico." });
});
app.get("/api/seller/payouts", async (req, res) => {
  let uid;
  try {
    uid = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const txSnap = await adminDb.collection("transactions").where("seller_id", "==", uid).orderBy("held_since", "desc").limit(20).get();
    const payouts = [];
    for (const doc of txSnap.docs) {
      const data = doc.data() || {};
      let title = "Dra\u017Eba";
      if (data.auction_id) {
        try {
          const aSnap = await safeGetDoc(adminDb.collection("auctions").doc(data.auction_id));
          if (aSnap.exists()) {
            const aData = aSnap.data() || {};
            title = aData.title?.SLO || aData.title?.EN || aData.title || "Dra\u017Eba";
          }
        } catch (_) {
        }
      }
      payouts.push({
        id: doc.id,
        title,
        seller_net_cents: data.seller_net_cents || (data.item_price ? Math.round(data.item_price * 100) : 0),
        payout_status: data.payout_status || "held",
        held_since: data.held_since || data.created_at || null,
        auto_release_at: data.auto_release_at || null,
        paid_out_at: data.paid_out_at || null
      });
    }
    return res.json({ success: true, payouts });
  } catch (err) {
    console.error("Error fetching seller payouts:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/create-subscription-checkout", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const { amount, currency = "eur", package_id, return_url } = req.body || {};
    const stripe = getStripe();
    const packageIdStr = (package_id || "").toLowerCase();
    let finalAmountCents = 0;
    if (packageIdStr.includes("pro")) {
      finalAmountCents = 5e3;
    } else if (packageIdStr.includes("basic")) {
      finalAmountCents = 2e3;
    } else {
      finalAmountCents = parseAmountToCents(amount);
    }
    if (finalAmountCents <= 0) {
      return res.status(400).json({ error: "Invalid subscription payment amount" });
    }
    let customerId = void 0;
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(userId));
    if (userDoc.exists()) {
      const cId = await getOrCreateStripeCustomer(stripe, userId, userDoc.data());
      if (cId) customerId = cId;
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_update: { name: "auto", address: "auto" },
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency,
          product_data: {
            name: `Naro\u010Dnina - Paket ${package_id || "Premium"}`
          },
          unit_amount: finalAmountCents
        },
        quantity: 1
      }],
      metadata: {
        type: "subscription",
        user_id: userId,
        package_id: package_id || "",
        amount: finalAmountCents.toString()
      },
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: {
          type: "subscription",
          user_id: userId,
          package_id: package_id || "",
          amount: finalAmountCents.toString()
        }
      },
      mode: "payment",
      success_url: return_url && return_url.includes("/stripe-callback.html") ? `${return_url}?payment=success&type=subscription&session_id={CHECKOUT_SESSION_ID}` : `${return_url || "https://www.drazbe.eu"}${return_url && return_url.includes("?") ? "&" : "?"}payment=success&type=subscription&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: return_url && return_url.includes("/stripe-callback.html") ? `${return_url}?payment=cancel` : `${return_url || "https://www.drazbe.eu"}${return_url && return_url.includes("?") ? "&" : "?"}payment=cancel`
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Subscription Checkout Error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/sync-user-subscription", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const targetUserId = userId;
    const userDocRef = adminDb.collection("users").doc(targetUserId);
    const userDoc = await safeGetDoc(userDocRef);
    if (!userDoc.exists()) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();
    const stripe = getStripe();
    if (!stripe) {
      return res.json({ synced: false, reason: "Stripe not initialized" });
    }
    const now = /* @__PURE__ */ new Date();
    const currentTier = (userData.subscription_tier || userData.subscription || "").toUpperCase();
    const isActive = userData.subscription_active === true;
    const validUntilStr = userData.subscription_valid_until;
    const isValid = validUntilStr ? new Date(validUntilStr) > now : false;
    if (isActive && isValid && currentTier && currentTier !== "FREE") {
      return res.json({
        success: true,
        synced: false,
        already_active: true,
        subscription_tier: currentTier,
        subscription_valid_until: validUntilStr
      });
    }
    const customerId = userData.stripe_customer_id || userData.stripeCustomerId;
    const userEmail = (userData.email || "").toLowerCase().trim();
    let matchingSession = null;
    try {
      if (customerId) {
        const customerSessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 20 });
        for (const sess of customerSessions.data) {
          if (sess.payment_status === "paid" || sess.status === "complete") {
            const sessDate = new Date(sess.created * 1e3);
            const ageInDays = (now.getTime() - sessDate.getTime()) / (1e3 * 60 * 60 * 24);
            if (ageInDays <= 35) {
              const isSub = sess.metadata?.type === "subscription" || sess.amount_total === 2e3 || sess.amount_total === 5e3 || sess.mode === "subscription";
              if (isSub) {
                matchingSession = sess;
                break;
              }
            }
          }
        }
      }
      if (!matchingSession) {
        const recentSessions = await stripe.checkout.sessions.list({ limit: 40 });
        for (const sess of recentSessions.data) {
          if (sess.payment_status === "paid" || sess.status === "complete") {
            const sessDate = new Date(sess.created * 1e3);
            const ageInDays = (now.getTime() - sessDate.getTime()) / (1e3 * 60 * 60 * 24);
            if (ageInDays <= 35) {
              const sessEmail = (sess.customer_details?.email || sess.customer_email || "").toLowerCase().trim();
              const sessUid = sess.metadata?.user_id || sess.metadata?.buyer_id || sess.client_reference_id;
              const isMatch = sessUid && sessUid === targetUserId || userEmail && sessEmail && sessEmail === userEmail || customerId && sess.customer === customerId;
              if (isMatch) {
                const isSub = sess.metadata?.type === "subscription" || sess.amount_total === 2e3 || sess.amount_total === 5e3 || sess.mode === "subscription";
                if (isSub) {
                  matchingSession = sess;
                  break;
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[sync-user-subscription] Error searching Stripe checkout sessions:", err.message);
    }
    if (matchingSession) {
      let tier = (matchingSession.metadata?.package_id || matchingSession.metadata?.tier || matchingSession.metadata?.planId || "").toUpperCase();
      if (!tier || !tier.includes("PRO") && !tier.includes("BASIC")) {
        tier = matchingSession.amount_total === 5e3 ? "PRO" : "BASIC";
      }
      const paidDate = new Date(matchingSession.created * 1e3);
      const validUntil = new Date(paidDate);
      validUntil.setMonth(validUntil.getMonth() + 1);
      const updateData = {
        subscription_tier: tier,
        subscription: tier,
        subscription_active: true,
        subscription_paid_at: paidDate.toISOString(),
        subscription_started_at: paidDate.toISOString(),
        subscription_cycle_started_at: paidDate.toISOString(),
        subscription_valid_until: validUntil.toISOString(),
        subscription_canceled: false,
        stripe_checkout_session_id: matchingSession.id
      };
      if (matchingSession.customer) {
        updateData.stripe_customer_id = typeof matchingSession.customer === "string" ? matchingSession.customer : matchingSession.customer.id;
      }
      if (matchingSession.subscription) {
        updateData.stripe_subscription_id = typeof matchingSession.subscription === "string" ? matchingSession.subscription : matchingSession.subscription.id;
      }
      await userDocRef.set(updateData, { merge: true });
      console.log(`[sync-user-subscription] Successfully synced user ${targetUserId} to ${tier}`);
      return res.json({
        success: true,
        synced: true,
        subscription_tier: tier,
        subscription_active: true,
        subscription_valid_until: validUntil.toISOString()
      });
    }
    try {
      const recentPIs = await stripe.paymentIntents.list({ limit: 40 });
      for (const pi of recentPIs.data) {
        if (pi.status === "succeeded") {
          const piDate = new Date(pi.created * 1e3);
          const ageInDays = (now.getTime() - piDate.getTime()) / (1e3 * 60 * 60 * 24);
          if (ageInDays <= 35) {
            const piEmail = (pi.receipt_email || "").toLowerCase().trim();
            const piUid = pi.metadata?.user_id || pi.metadata?.buyer_id;
            const isMatch = piUid && piUid === targetUserId || userEmail && piEmail && piEmail === userEmail || customerId && pi.customer === customerId;
            const isSub = pi.metadata?.type === "subscription" || pi.amount === 2e3 || pi.amount === 5e3;
            if (isMatch && isSub) {
              const tier = (pi.metadata?.package_id || (pi.amount === 5e3 ? "PRO" : "BASIC")).toUpperCase();
              const validUntil = new Date(piDate);
              validUntil.setMonth(validUntil.getMonth() + 1);
              const updateData = {
                subscription_tier: tier,
                subscription: tier,
                subscription_active: true,
                subscription_paid_at: piDate.toISOString(),
                subscription_started_at: piDate.toISOString(),
                subscription_cycle_started_at: piDate.toISOString(),
                subscription_valid_until: validUntil.toISOString(),
                subscription_canceled: false,
                stripe_payment_intent_id: pi.id
              };
              if (pi.customer) {
                updateData.stripe_customer_id = typeof pi.customer === "string" ? pi.customer : pi.customer.id;
              }
              await userDocRef.set(updateData, { merge: true });
              console.log(`[sync-user-subscription] Successfully synced user ${targetUserId} from PI to ${tier}`);
              return res.json({
                success: true,
                synced: true,
                subscription_tier: tier,
                subscription_active: true,
                subscription_valid_until: validUntil.toISOString()
              });
            }
          }
        }
      }
    } catch (piErr) {
      console.warn("[sync-user-subscription] Error searching PaymentIntents:", piErr.message);
    }
    return res.json({ success: true, synced: false, message: "Ni najdenih neobdelanih pla\u010Dil na Stripe." });
  } catch (error) {
    console.error("Error in sync-user-subscription:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/create-verification-session", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const targetUserId = userId;
    const stripe = getStripe();
    let user = null;
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(targetUserId));
    if (userDoc.exists()) {
      user = userDoc.data();
    }
    const formattedPhone = user?.phone ? formatE164Phone(user.phone, user.country_code || "SI") : void 0;
    const session = await stripe.identity.verificationSessions.create({
      type: "document",
      options: {
        document: {
          require_id_number: true,
          require_matching_selfie: true
        }
      },
      provided_details: {
        ...user?.email ? { email: user.email.trim() } : {},
        ...formattedPhone ? { phone: formattedPhone } : {}
      },
      metadata: {
        user_id: targetUserId || ""
      }
    });
    res.json({ clientSecret: session.client_secret });
  } catch (error) {
    console.error("Stripe Identity error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/test/send-email", async (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "true") {
    return res.status(404).json({ error: "Not found" });
  }
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const adminUids = (process.env.ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!adminUids.includes(userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return res.status(500).json({
        error: "RESEND_API_KEY is missing",
        message: "RESEND_API_KEY environment variable is not defined in the server environment.",
        resendConfigured: false
      });
    }
    const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) || {};
    const {
      toEmail,
      type = "outbid",
      recipientName = "Testni Uporabnik",
      auctionId = "test-auction-123",
      auctionTitle = "Industrijski CNC obdelovalni center Haas VF-2",
      currentPrice = 1250,
      auctionImageUrl = "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=60"
    } = body;
    if (!toEmail) {
      return res.status(400).json({ error: "E-po\u0161tni naslov prejemnika (toEmail) je obvezen." });
    }
    let sendResult = null;
    if (type === "outbid") {
      sendResult = await sendOutbidNotification({
        toEmail,
        recipientName,
        auctionId,
        auctionTitle,
        newPrice: currentPrice,
        auctionImageUrl
      });
    } else if (type === "ending_soon") {
      sendResult = await sendEndingSoonNotification({
        toEmail,
        recipientName,
        auctionId,
        auctionTitle,
        currentPrice,
        auctionImageUrl,
        endTimeFormatted: "\u010Dez 28 minut (danes ob 18:00)"
      });
    } else if (type === "won") {
      sendResult = await sendAuctionWonNotification({
        toEmail,
        recipientName,
        auctionId,
        auctionTitle,
        winningPrice: currentPrice,
        paymentDeadlineFormatted: "48 ur (v roku 2 dni)",
        auctionImageUrl
      });
    } else if (type === "payment_reminder") {
      sendResult = await sendPaymentReminderNotification({
        toEmail,
        recipientName,
        auctionId,
        auctionTitle,
        amount: currentPrice,
        paymentDeadlineFormatted: "\u010Dez 2 uri (danes ob 18:00)",
        auctionImageUrl
      });
    } else if (type === "receipt_invoice") {
      const fee = calculatePlatformFeeCents(Math.round(currentPrice * 100), "PRO") / 100;
      const mockTransaction = {
        id: `TX-${Date.now().toString().substring(6)}`,
        amount_total: currentPrice,
        platform_fee: fee,
        vat_amount: Math.round(fee * 0.22 * 100) / 100,
        vat_rate: 22,
        is_reverse_charge: false,
        status: "completed"
      };
      const mockBuyer = {
        first_name: recipientName.split(" ")[0] || "Janez",
        last_name: recipientName.split(" ")[1] || "Novak",
        email: toEmail,
        address: "Dunajska cesta 156, 1000 Ljubljana",
        user_type: "individual"
      };
      const mockSeller = {
        company_name: "Dizain d.o.o. (Testni prodajalec)",
        address: "Karantanska ulica 28, 2000 Maribor",
        tax_id: "SI57008060",
        company_status: "company"
      };
      const mockAuction = {
        id: auctionId,
        title: { SLO: auctionTitle, EN: auctionTitle },
        currentBid: currentPrice
      };
      const invoiceBuffer = await generateInvoicePDF(mockTransaction, mockBuyer, mockSeller, mockAuction, "RAC-TEST-000001", "PROV-TEST-000001");
      const attachments = [
        { filename: `racun_${mockTransaction.id}.pdf`, content: invoiceBuffer }
      ];
      const resendClient3 = new import_resend2.Resend(resendApiKey);
      const baseAppUrl = process.env.APP_URL && !process.env.APP_URL.includes("drazbenik.si") ? process.env.APP_URL : "https://drazbe.eu";
      const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuctionEmailTemplate, {
        type: "payment_success",
        recipientName: recipientName || "Uporabnik",
        auctionTitle,
        currentPrice,
        auctionUrl: `${baseAppUrl}/?drazba=${auctionId}`,
        settingsUrl: `${baseAppUrl}/?tab=settings`
      }));
      const emailResponse = await resendClient3.emails.send({
        from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
        to: toEmail,
        subject: `\u{1F9FE} Potrdilo o pla\u010Dilu in ra\u010Dun: ${auctionTitle} - dra\u017Ebenik.si`,
        html: htmlContent,
        attachments
      });
      if (emailResponse.error) {
        sendResult = { success: false, error: emailResponse.error.message };
      } else {
        sendResult = { success: true, messageId: emailResponse.data?.id };
      }
    } else {
      return res.status(400).json({ error: "Neznan tip e-po\u0161tnega obvestila." });
    }
    if (sendResult && sendResult.success === false) {
      return res.status(400).json({
        success: false,
        error: sendResult.error || "Napaka pri po\u0161iljanju e-po\u0161te preko Resend API.",
        type,
        toEmail,
        details: sendResult,
        resendConfigured: true
      });
    }
    return res.json({
      success: true,
      type,
      toEmail,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      details: sendResult,
      resendConfigured: true
    });
  } catch (error) {
    console.error("Email send error:", error);
    return res.status(500).json({
      error: error.message || "Nepri\u010Dakovana napaka pri po\u0161iljanju e-maila",
      stack: error.stack
    });
  }
});
app.post("/api/test/generate-pdf", async (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "true") {
    return res.status(404).json({ error: "Not found" });
  }
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const adminUids = (process.env.ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!adminUids.includes(userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const {
      relationshipType = "company_individual",
      sellerData = {},
      buyerData = {},
      itemTitle = "Paket orodja DeWalt (Komplet)",
      itemPrice = 1200,
      docType = "invoice",
      transaction: customTx,
      buyer: customBuyer,
      seller: customSeller,
      auction: customAuction,
      salesInvoiceNo,
      commissionInvoiceNo
    } = req.body;
    const mockTx = customTx || {
      id: `TX-${Date.now().toString().substring(5)}`,
      amount_total: Number(itemPrice),
      platform_fee: Math.round(Number(itemPrice) * 0.1 * 100) / 100,
      vat_amount: Math.round(Number(itemPrice) * 0.1 * 0.22 * 100) / 100,
      fee_total: Math.round(Number(itemPrice) * 0.1 * 1.22 * 100) / 100,
      vat_rate: 22,
      is_reverse_charge: relationshipType === "company_company",
      status: "completed",
      paid_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    const mockAuction = customAuction || {
      id: `AUCT-${Date.now().toString().substring(6)}`,
      title: { SLO: itemTitle, EN: itemTitle },
      currentBid: Number(itemPrice),
      delivery_method: "pickup"
    };
    let seller = customSeller ? { ...customSeller } : { ...sellerData };
    let buyer = customBuyer ? { ...customBuyer } : { ...buyerData };
    if (!customSeller) {
      if (relationshipType === "individual_individual") {
        seller = {
          first_name: sellerData.first_name || "Marko",
          last_name: sellerData.last_name || "Horvat",
          address: sellerData.address || "Celjska cesta 42, 3000 Celje",
          company_status: "individual",
          user_type: "individual"
        };
      } else if (relationshipType === "individual_company") {
        seller = {
          first_name: sellerData.first_name || "Janez",
          last_name: sellerData.last_name || "Kranjc",
          address: sellerData.address || "Cesta v Gorice 14, 1000 Ljubljana",
          company_status: "individual",
          user_type: "individual"
        };
      } else {
        seller = {
          company_name: sellerData.company_name || "AvtoCenter d.o.o.",
          tax_id: sellerData.tax_id || "SI 12345678",
          registration_number: sellerData.registration_number || "8876543000",
          address: sellerData.address || "Tr\u017Ea\u0161ka cesta 14, 2000 Maribor",
          company_status: "company",
          user_type: "business"
        };
      }
    }
    if (!customBuyer) {
      if (relationshipType === "company_company" || relationshipType === "individual_company") {
        buyer = {
          company_name: buyerData.company_name || "TechTrade d.o.o.",
          tax_id: buyerData.tax_id || "SI 87654321",
          registration_number: buyerData.registration_number || "9988776000",
          address: buyerData.address || "Letali\u0161ka cesta 33, 1000 Ljubljana",
          company_status: "company",
          user_type: "business"
        };
      } else {
        buyer = {
          first_name: buyerData.first_name || "Marko",
          last_name: buyerData.last_name || "Novak",
          address: buyerData.address || "Dunajska cesta 105, 1000 Ljubljana",
          company_status: "individual",
          user_type: "individual"
        };
      }
    }
    let pdfBuffer;
    let filename;
    const sInvNo = salesInvoiceNo || `RA\u010C-${(/* @__PURE__ */ new Date()).getFullYear()}-${mockAuction.id.substring(mockAuction.id.length - 5).toUpperCase()}`;
    const cInvNo = commissionInvoiceNo || `PROV-${(/* @__PURE__ */ new Date()).getFullYear()}-${mockTx.id.substring(mockTx.id.length - 5).toUpperCase()}`;
    if (docType === "certificate") {
      pdfBuffer = await generateCertificatePDF(mockTx, buyer, seller);
      filename = `Potrdilo_${mockTx.id}.pdf`;
    } else {
      pdfBuffer = await generateInvoicePDF(mockTx, buyer, seller, mockAuction, sInvNo, cInvNo);
      filename = `Racun_${sInvNo}.pdf`;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Test generate-pdf error:", err);
    res.status(500).json({ error: err.message || "Napaka pri generiranju testnega PDF" });
  }
});
app.post("/api/test/test-payout", async (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "true") {
    return res.status(404).json({ error: "Not found" });
  }
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const adminUids = (process.env.ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!adminUids.includes(userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const { amount = 50, executeReal = false } = req.body || {};
    const amountInCents = parseAmountToCents(amount);
    if (amountInCents <= 0) {
      return res.status(400).json({ error: "Znesek izpla\u010Dila mora biti ve\u010Dji od 0." });
    }
    const userDocRef = adminDb.collection("users").doc(userId);
    const userDoc = await safeGetDoc(userDocRef);
    if (!userDoc.exists()) {
      return res.status(404).json({ error: "Uporabnik ne obstaja v bazi." });
    }
    const userData = userDoc.data() || {};
    const wallet = await getUserWallet(userId);
    const stripe = getStripe();
    const diag = await diagnoseStripeTransferPrerequisites(stripe, userData, amountInCents);
    const logs = [
      `[1] Preverjanje uporabnika: ${userData.first_name || ""} ${userData.last_name || userData.username || userId} (ID: ${userId})`,
      `[2] Trenutno razpolo\u017Eljivo stanje v denarnici: ${(wallet.available_cents / 100).toFixed(2)} \u20AC (${wallet.available_cents} centov)`,
      `[3] Zahtevan znesek izpla\u010Dila: ${(amountInCents / 100).toFixed(2)} \u20AC (${amountInCents} centov)`,
      ...diag.logs
    ];
    const hasSufficientBalance = wallet.available_cents >= amountInCents;
    logs.push(`[*] Preverjanje stanja denarnice: ${hasSufficientBalance ? "DA (Zadostno dobroimetje)" : "NE (Nezadostno dobroimetje)"}`);
    if (executeReal) {
      if (!hasSufficientBalance) {
        logs.push(`[X] Prekinitev: Sredstva v denarnici niso zadostna.`);
        return res.status(400).json({
          success: false,
          error: "Nezadostno stanje v denarnici za izvedbo izpla\u010Dila.",
          logs,
          diagnostics: diag.details
        });
      }
      if (!diag.ready) {
        logs.push(`[X] Prekinitev: Zahteve Stripe Connect ra\u010Duna niso izpolnjene.`);
        return res.status(400).json({
          success: false,
          error: diag.issues[0] || "Stripe ra\u010Dun ni pripravljen za izpla\u010Dilo.",
          logs,
          diagnostics: diag.details
        });
      }
      const stripeAccountId = userData.stripeAccountId || userData.stripe_account_id;
      const idempotencyKey = `test_payout_${userId}_${Date.now()}`;
      logs.push(`[->] Rezervacija sredstev v denarnici (${amountInCents} centov)...`);
      let txId;
      try {
        txId = await reserveWalletFunds(userId, amountInCents, "withdrawal", idempotencyKey, {
          description: `Testno izpla\u010Dilo preko Stripe Connect (${(amountInCents / 100).toFixed(2)} \u20AC)`,
          environment: "sandbox"
        });
        logs.push(`[OK] Sredstva uspe\u0161no rezervirana (ID transakcije: ${txId})`);
      } catch (reserveErr) {
        logs.push(`[X] Rezervacija ni uspela: ${reserveErr.message}`);
        return res.status(400).json({ success: false, error: reserveErr.message, logs });
      }
      await ensurePlatformTestBalance(stripe, amountInCents);
      logs.push(`[->] Izvajanje Stripe Connect transferja na ra\u010Dun ${stripeAccountId}...`);
      try {
        const transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: "eur",
          destination: stripeAccountId,
          description: `Testno izpla\u010Dilo drazbenik.si za ${userId}`
        }, {
          idempotencyKey
        });
        logs.push(`[OK] Stripe transfer uspe\u0161no izveden! ID nakazila: ${transfer.id}`);
        await commitReservedFunds(txId, {
          stripe_transfer_id: transfer.id,
          status: "completed"
        });
        logs.push(`[OK] Knji\u017Eenje v denarnici potrjeno. Transakcija zaklju\u010Dena.`);
        const updatedWallet = await getUserWallet(userId);
        logs.push(`[=] Novo razpolo\u017Eljivo stanje v denarnici: ${(updatedWallet.available_cents / 100).toFixed(2)} \u20AC`);
        return res.json({
          success: true,
          simulation: false,
          transfer_id: transfer.id,
          requestedAmount: amountInCents / 100,
          previousBalance: wallet.available_cents / 100,
          newBalance: updatedWallet.available_cents / 100,
          available_cents: updatedWallet.available_cents,
          logs,
          diagnostics: diag.details
        });
      } catch (transferErr) {
        logs.push(`[X] Stripe transfer ni uspel: ${transferErr.message}`);
        await rollbackReservedFunds(txId);
        logs.push(`[!] Rezervirana sredstva vrnjena v denarnico uporabnika (rollback).`);
        const safeErr = formatStripeError(transferErr);
        logs.push(`[Diagnoza] Koda napake: ${safeErr.code || safeErr.type || "neznana"}, Sporo\u010Dilo: ${safeErr.userMessage}`);
        return res.status(400).json({
          success: false,
          error: safeErr.userMessage,
          logs,
          diagnostics: {
            ...diag.details,
            stripeError: safeErr
          }
        });
      }
    } else {
      logs.push(`[7] Na\u010Din simulacije: Denarnica ni bila zmanj\u0161ana in Stripe transfer ni bil spro\u017Een.`);
      logs.push(`[8] Vklopi stikalo 'Izvedi pravo izpla\u010Dilo' za dejansko nakazilo preko Stripe Connect.`);
      return res.json({
        success: true,
        simulation: true,
        requestedAmount: amountInCents / 100,
        previousBalance: wallet.available_cents / 100,
        newBalance: wallet.available_cents / 100,
        available_cents: wallet.available_cents,
        stripeAccountStatus: diag.ready ? "ready" : diag.details.stripeAccountId ? "onboarding_required" : "missing",
        logs,
        diagnostics: diag.details
      });
    }
  } catch (err) {
    console.error("Test payout error:", err);
    res.status(500).json({ error: err.message || "Napaka pri testnem izpla\u010Dilu" });
  }
});
app.post("/api/test/add-test-funds", async (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "true") {
    return res.status(404).json({ error: "Not found" });
  }
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const adminUids = (process.env.ADMIN_UIDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!adminUids.includes(userId)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY || "";
    if (!stripeKey.startsWith("sk_test_")) {
      return res.status(400).json({ error: "Ta funkcija je na voljo le v testnem na\u010Dinu (Stripe Sandbox)." });
    }
    const { amount = 100 } = req.body || {};
    const amountInCents = parseAmountToCents(amount);
    if (amountInCents <= 0) {
      return res.status(400).json({ error: "Znesek mora biti ve\u010Dji od 0" });
    }
    const stripe = getStripe();
    const clientKey = req.body?.idempotencyKey || `pi_test_${Date.now()}`;
    const stripeIdempotencyKey = `stripe_pi_test_funding_${userId}_${clientKey}`;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: "eur",
      payment_method: "pm_card_visa",
      confirm: true,
      return_url: "https://drazbe.eu/test-sandbox",
      payment_method_types: ["card"],
      description: "Platform test balance funding",
      metadata: {
        purpose: "test_wallet_funding",
        user_id: userId,
        environment: "test"
      }
    }, {
      idempotencyKey: stripeIdempotencyKey
    });
    console.log(`[test-wallet-funding] userId=${userId} paymentIntentId=${paymentIntent.id} amountCents=${amountInCents} status=${paymentIntent.status}`);
    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        error: `Stripe testno pla\u010Dilo ni uspelo (stanje: ${paymentIntent.status})`,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status
      });
    }
    const result = await creditWalletDepositFromStripe(userId, amountInCents, paymentIntent.id, {
      description: "Platform test balance funding",
      environment: "test",
      idempotencyKey: `wallet_dep_${paymentIntent.id}`
    });
    res.json({
      success: true,
      stripe_payment_intent_id: paymentIntent.id,
      transaction_id: result.transaction_id,
      amount: amountInCents / 100,
      amount_cents: amountInCents,
      newBalance: result.wallet_balance,
      available_cents: result.available_cents,
      wallet_balance: result.wallet_balance,
      already_processed: result.already_processed
    });
  } catch (err) {
    console.error("Add test funds error:", err);
    const formatted = formatStripeError(err);
    res.status(500).json({ error: formatted.userMessage || "Napaka pri izvedbi Stripe testnega pla\u010Dila" });
  }
});
var enhanceRateLimitMin = null;
var enhanceRateLimitDay = null;
var analyzeRateLimitHour = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const redisClient = new import_redis.Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
    enhanceRateLimitMin = new import_ratelimit.Ratelimit({
      redis: redisClient,
      limiter: import_ratelimit.Ratelimit.slidingWindow(5, "1 m")
    });
    enhanceRateLimitDay = new import_ratelimit.Ratelimit({
      redis: redisClient,
      limiter: import_ratelimit.Ratelimit.slidingWindow(30, "24 h")
    });
    analyzeRateLimitHour = new import_ratelimit.Ratelimit({
      redis: redisClient,
      limiter: import_ratelimit.Ratelimit.slidingWindow(10, "1 h")
    });
  } catch (err) {
    console.warn("Failed to initialize AI Upstash limiters:", err);
  }
}
async function checkEnhanceRateLimit(uid) {
  if (enhanceRateLimitMin && enhanceRateLimitDay) {
    try {
      const minResult = await enhanceRateLimitMin.limit(`enhance_min_${uid}`);
      if (!minResult.success) return false;
      const dayResult = await enhanceRateLimitDay.limit(`enhance_day_${uid}`);
      return dayResult.success;
    } catch (e) {
      console.warn("Upstash limit check error, falling back to Firestore:", e);
    }
  }
  try {
    const limitRef = adminDb.collection("user_rate_limits").doc(uid);
    const limitSnap = await limitRef.get();
    const now = Date.now();
    const limitData = limitSnap.exists ? limitSnap.data() || {} : {};
    const minTimestamp = limitData.enhance_min_ts || 0;
    let minCount = limitData.enhance_min_cnt || 0;
    if (now - minTimestamp > 60 * 1e3) {
      minCount = 0;
    }
    if (minCount >= 5) return false;
    const dayTimestamp = limitData.enhance_day_ts || 0;
    let dayCount = limitData.enhance_day_cnt || 0;
    if (now - dayTimestamp > 24 * 60 * 60 * 1e3) {
      dayCount = 0;
    }
    if (dayCount >= 30) return false;
    const updates = {};
    if (minCount === 0) updates.enhance_min_ts = now;
    updates.enhance_min_cnt = minCount + 1;
    if (dayCount === 0) updates.enhance_day_ts = now;
    updates.enhance_day_cnt = dayCount + 1;
    await limitRef.set(updates, { merge: true });
    return true;
  } catch (fsErr) {
    console.warn("Firestore rate limit fallback error:", fsErr);
    return true;
  }
}
async function checkAnalyzeRateLimit(uid) {
  if (analyzeRateLimitHour) {
    try {
      const result = await analyzeRateLimitHour.limit(`analyze_hour_${uid}`);
      return result.success;
    } catch (e) {
      console.warn("Upstash limit check error for analyze, falling back:", e);
    }
  }
  try {
    const limitRef = adminDb.collection("user_rate_limits").doc(uid);
    const limitSnap = await limitRef.get();
    const now = Date.now();
    const limitData = limitSnap.exists ? limitSnap.data() || {} : {};
    const hourTimestamp = limitData.analyze_hour_ts || 0;
    let hourCount = limitData.analyze_hour_cnt || 0;
    if (now - hourTimestamp > 60 * 60 * 1e3) {
      hourCount = 0;
    }
    if (hourCount >= 10) return false;
    const updates = {};
    if (hourCount === 0) updates.analyze_hour_ts = now;
    updates.analyze_hour_cnt = hourCount + 1;
    await limitRef.set(updates, { merge: true });
    return true;
  } catch (fsErr) {
    console.warn("Firestore rate limit analyze fallback error:", fsErr);
    return true;
  }
}
app.post("/api/ai/enhance-image", async (req, res) => {
  try {
    let uid;
    try {
      uid = await authenticateFirebaseUser(req);
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || "Unauthorized" });
    }
    const { image_base64, mime_type } = req.body;
    if (!image_base64) {
      return res.status(400).json({ error: "Manjka slikovni podatek (image_base64)." });
    }
    if (!mime_type || mime_type !== "image/jpeg" && mime_type !== "image/png" && mime_type !== "image/webp") {
      return res.status(400).json({ error: "Nepodprt tip slike (mime_type). Dovoljeni so: image/jpeg, image/png ali image/webp." });
    }
    const decodedLength = image_base64.length * 3 / 4 - (image_base64.endsWith("==") ? 2 : image_base64.endsWith("=") ? 1 : 0);
    if (decodedLength > 4 * 1024 * 1024) {
      return res.status(400).json({ error: "Slika presega najve\u010Djo dovoljeno velikost 4 MB." });
    }
    const allowed = await checkEnhanceRateLimit(uid);
    if (!allowed) {
      return res.status(429).json({ error: "Presegli ste omejitev po\u0161iljanja za polep\u0161anje slik (najve\u010D 5 na minuto in 30 na dan)." });
    }
    const ai = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: image_base64,
              mimeType: mime_type
            }
          },
          {
            text: "Enhance the quality, lighting, and sharpness of this image. Keep the original subject exactly the same, just make it look more professional and appealing."
          }
        ]
      },
      config: {
        responseModalities: ["IMAGE", "TEXT"]
      }
    });
    let newBase64 = null;
    let newMime = mime_type;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        newBase64 = part.inlineData.data;
        newMime = part.inlineData.mimeType || mime_type;
        break;
      }
    }
    if (!newBase64) {
      return res.status(502).json({ error: "Polep\u0161anje slike trenutno ni uspelo. Poskusite znova ali uporabite izvirno sliko." });
    }
    return res.json({
      image_base64: newBase64,
      mime_type: newMime
    });
  } catch (err) {
    console.error("Error in /api/ai/enhance-image:", err);
    return res.status(502).json({ error: "Storitev umetne inteligence trenutno ni na voljo. Poskusite znova pozneje." });
  }
});
app.post("/api/analyze-receipt", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const { imageUrl } = req.body;
    if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.startsWith("https://")) {
      return res.status(400).json({ error: "Invalid image URL. Must be a secure HTTPS link." });
    }
    try {
      const parsedUrl = new URL(imageUrl);
      const host = parsedUrl.host;
      if (host !== "firebasestorage.googleapis.com" && host !== "storage.googleapis.com") {
        return res.status(400).json({ error: "Dostop zavrnjen. Gostitelj slike mora biti firebasestorage.googleapis.com ali storage.googleapis.com." });
      }
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "drazbesi.firebasestorage.app";
      if (!imageUrl.includes(bucketName)) {
        return res.status(400).json({ error: "Dostop zavrnjen. Slika ne pripada dovoljenemu vedru shranjevanja." });
      }
    } catch (urlErr) {
      return res.status(400).json({ error: "Neveljaven URL slike." });
    }
    const allowed = await checkAnalyzeRateLimit(userId);
    if (!allowed) {
      return res.status(429).json({ error: "Presegli ste urno omejitev analiziranja ra\u010Dunov (najve\u010D 10 na uro)." });
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1e4);
    let fetchResponse;
    try {
      fetchResponse = await fetch(imageUrl, { signal: controller.signal });
    } catch (fetchErr) {
      if (fetchErr.name === "AbortError") {
        return res.status(400).json({ error: "\u010Cas za prenos slike je potekel (najve\u010D 10 sekund)." });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }
    const contentType = fetchResponse.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return res.status(400).json({ error: "Napa\u010Dna vrsta vsebine. Dovoljene so le slike." });
    }
    const contentLengthStr = fetchResponse.headers.get("content-length");
    if (contentLengthStr) {
      const contentLength = parseInt(contentLengthStr, 10);
      if (contentLength > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "Slika je prevelika (najve\u010Dja dovoljena velikost je 5 MB)." });
      }
    }
    const arrayBuffer = await fetchResponse.arrayBuffer();
    if (arrayBuffer.byteLength > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "Slika je prevelika (najve\u010Dja dovoljena velikost je 5 MB)." });
    }
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = contentType || "image/jpeg";
    const ai = new import_genai.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const geminiResponse = await ai.models.generateContent({
      model: process.env.GEMINI_TEXT_MODEL || "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: 'Analiziraj ta ra\u010Dun iz po\u0161te. Poi\u0161\u010Di skupni znesek po\u0161tnine ali kon\u010Dni znesek za pla\u010Dilo. Vrni izklju\u010Dno JSON objekt v obliki: {"shipping_cost": float, "currency": "EUR"}. \u010Ce zneska ne more\u0161 z gotovostjo razbrati, vrni {"shipping_cost": null}.' }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });
    const resultText = geminiResponse.text || "{}";
    res.json(JSON.parse(resultText));
  } catch (e) {
    console.error("Gemini Vision error in /api/analyze-receipt:", e);
    res.status(502).json({ error: "Storitev umetne inteligence trenutno ni na voljo. Poskusite znova pozneje." });
  }
});
async function checkAndApplySellerPenalties(seller_id) {
  try {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1e3).toISOString();
    const snapshot = await safeGetDocs(
      adminDb.collection("seller_strikes").where("user_id", "==", seller_id)
    );
    const recentStrikes = snapshot.docs.filter((d) => {
      const data = d.data();
      return data.created_at >= sixMonthsAgo;
    });
    if (recentStrikes.length >= 3) {
      const blockedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString();
      await adminDb.collection("users").doc(seller_id).update({
        auction_blocked_until: blockedUntil
      });
      console.log(`Seller ${seller_id} penalized: auctions blocked until ${blockedUntil} due to 3+ strikes.`);
    }
  } catch (e) {
    console.error("Error applying seller penalties:", e);
  }
}
app.post("/api/auctions/create", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  if (createAuctionRateLimiter) {
    try {
      const { success } = await createAuctionRateLimiter.limit(userId);
      if (!success) {
        return res.status(429).json({ error: "Preve\u010D ustvarjenih dra\u017Eb v tem \u010Dasovnem okviru." });
      }
    } catch (err) {
      console.warn("Rate limit check failed:", err);
    }
  }
  try {
    const { itemData } = req.body;
    const sanitizeString = (str) => {
      if (typeof str !== "string") return str;
      return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    };
    if (itemData) {
      if (itemData.title) itemData.title = sanitizeString(itemData.title);
      if (itemData.description) itemData.description = sanitizeString(itemData.description);
      if (itemData.category) itemData.category = sanitizeString(itemData.category);
      if (itemData.region) itemData.region = sanitizeString(itemData.region);
      if (itemData.location) itemData.location = sanitizeString(itemData.location);
      delete itemData.winner_id;
      delete itemData.winnerId;
      delete itemData.top_bids;
      delete itemData.bidding_history;
      delete itemData.payment_status;
      delete itemData.post_auction_status;
      const images = itemData.images || [];
      if (!Array.isArray(images)) {
        return res.status(400).json({ error: "Slike morajo biti seznam povezav (polje)." });
      }
      if (images.length > 10) {
        return res.status(400).json({ error: "Dovoljenih je najve\u010D 10 slik." });
      }
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "drazbesi.firebasestorage.app";
      const allowedPrefixEncoded = `auction-images%2F${userId}%2F`;
      const allowedPrefixDecoded = `auction-images/${userId}/`;
      for (const imgUrl of images) {
        if (typeof imgUrl !== "string") {
          return res.status(400).json({ error: "Neveljaven URL slike." });
        }
        if (!imgUrl.startsWith("https://")) {
          return res.status(400).json({ error: "Vse slike morajo uporabljati varno HTTPS povezavo." });
        }
        try {
          const parsedUrl = new URL(imgUrl);
          if (parsedUrl.host !== "firebasestorage.googleapis.com") {
            return res.status(400).json({ error: "Slike morajo biti shranjene na firebasestorage.googleapis.com." });
          }
          if (!imgUrl.includes(bucketName)) {
            return res.status(400).json({ error: "Slike morajo pripadati projektu drazba.si." });
          }
          if (!imgUrl.includes(allowedPrefixEncoded) && !imgUrl.includes(allowedPrefixDecoded)) {
            return res.status(400).json({ error: `Nalagate lahko le slike v svojo mapo (${allowedPrefixDecoded}).` });
          }
        } catch (e) {
          return res.status(400).json({ error: "Neveljaven URL slike." });
        }
      }
    }
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(userId));
    if (!userDoc.exists()) return res.status(404).json({ error: "Uporabnik ne obstaja" });
    const userData = userDoc.data() || {};
    if (userData.isBlocked) {
      return res.status(403).json({ error: "Va\u0161 ra\u010Dun je za\u010Dasno blokiran." });
    }
    try {
      await assertVerifiedUser(userId, userData);
    } catch (verErr) {
      return res.status(403).json({ error: verErr.message, code: verErr.code });
    }
    if (userData.stripe_onboarding_complete !== true) {
      return res.status(403).json({ error: "Za objavo dra\u017Ebe morate najprej urediti izpla\u010Dila.", code: "PAYOUTS_NOT_READY" });
    }
    const subTier = userData.subscription_tier || userData.subscription || "FREE";
    let limit = 5;
    if (subTier === "BASIC") limit = 50;
    if (subTier === "PRO") limit = Infinity;
    if (limit !== Infinity && !itemData.id) {
      const now = /* @__PURE__ */ new Date();
      const firstDayOfMonthMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const userAuctions = await adminDb.collection("auctions").where("seller_id", "==", userId).get();
      const monthlyCount = userAuctions.docs.filter((doc) => {
        const d = doc.data();
        const createdVal = d.created_at || d.createdAt || d.end_time || d.endTime;
        if (!createdVal) return false;
        return new Date(createdVal).getTime() >= firstDayOfMonthMs;
      }).length;
      if (monthlyCount >= limit) {
        return res.status(403).json({ error: `Dosegli ste mese\u010Dno omejitev objav za va\u0161 naro\u010Dni\u0161ki paket (${limit}). Prosimo, nadgradite paket.` });
      }
    }
    if (userData.auction_blocked_until) {
      const blockedUntil = new Date(userData.auction_blocked_until);
      if (blockedUntil > /* @__PURE__ */ new Date()) {
        return res.status(403).json({ error: `Objavljanje novih dra\u017Eb vam je onemogo\u010Deno do ${blockedUntil.toLocaleDateString()} zaradi ve\u010Dkratnih kr\u0161itev roka za odpo\u0161iljanje predmeta.` });
      }
    }
    if (itemData) {
      if (itemData.end_time) itemData.end_time = new Date(itemData.end_time).toISOString();
      if (itemData.endTime) itemData.endTime = new Date(itemData.endTime).toISOString();
      if (itemData.payment_deadline) itemData.payment_deadline = new Date(itemData.payment_deadline).toISOString();
    }
    const newDocRef = itemData.id ? adminDb.collection("auctions").doc(itemData.id) : adminDb.collection("auctions").doc();
    await newDocRef.set({
      ...itemData,
      id: newDocRef.id,
      seller_id: userId,
      status: "active",
      created_at: itemData.created_at || itemData.createdAt || (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    res.json({ success: true, id: newDocRef.id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
var handleProcessShippingDeadlines = async (req, res) => {
  if (!requireCronSecret(req, res)) return;
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const snapshot = await safeGetDocs(
      adminDb.collection("transactions").where("status", "==", "HELD_IN_ESCROW")
    );
    let processed = 0;
    for (const docSnap of snapshot.docs) {
      const tx = docSnap.data();
      let txDeliveryMethod = tx.delivery_method;
      if (!txDeliveryMethod && tx.auction_id) {
        const auctionSnap = await safeGetDoc(adminDb.collection("auctions").doc(tx.auction_id));
        txDeliveryMethod = auctionSnap.exists() ? auctionSnap.data().delivery_method : null;
      }
      if (!isPostalDelivery(txDeliveryMethod)) continue;
      const paidReference = tx.paid_at || tx.held_since;
      let deadline = tx.shipping_deadline;
      if (!deadline && paidReference) {
        deadline = new Date(new Date(paidReference).getTime() + SHIP_DEADLINE_DAYS * 24 * 60 * 60 * 1e3).toISOString();
      }
      if (deadline && now >= deadline) {
        const refundRes = await refundTransactionToBuyer(docSnap.id, "seller_no_shipment");
        if (refundRes.ok) {
          await adminDb.collection("seller_strikes").add({
            user_id: tx.seller_id,
            order_id: docSnap.id,
            reason: "NO_SHIPMENT_IN_DEADLINE",
            created_at: now
          });
          const sellerRef = adminDb.collection("users").doc(tx.seller_id);
          const sellerDoc = await safeGetDoc(sellerRef);
          if (sellerDoc.exists()) {
            const notes = sellerDoc.data().system_notes || [];
            await sellerRef.update({
              system_notes: [...notes, `Naro\u010Dilo preklicano \u2013 predmet ni bil poslan v roku (Naro\u010Dilo: ${docSnap.id})`]
            });
          }
          await checkAndApplySellerPenalties(tx.seller_id);
          try {
            const freshTxSnap = await docSnap.ref.get();
            const freshTx = freshTxSnap.data() || {};
            if (!freshTx.email_flags?.shipping_cancelled) {
              const buyerDoc = await safeGetDoc(adminDb.collection("users").doc(tx.buyer_id));
              const buyer = buyerDoc.data() || {};
              const sellerDoc2 = await safeGetDoc(adminDb.collection("users").doc(tx.seller_id));
              const seller = sellerDoc2.data() || {};
              const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(tx.auction_id));
              const auction = auctionDoc.data() || {};
              if (buyer.email && seller.email) {
                await sendShippingCancelledNotifications({
                  buyerEmail: buyer.email,
                  sellerEmail: seller.email,
                  buyerName: buyer.first_name || buyer.name,
                  sellerName: seller.first_name || seller.name,
                  auctionId: tx.auction_id,
                  auctionTitle: auction?.title?.SLO || "Predmet dra\u017Ebe",
                  auctionImageUrl: auction?.images?.[0]?.url || auction?.images?.[0],
                  totalAmount: Number(tx.amount_total || tx.amount || 0)
                });
                await docSnap.ref.update({
                  "email_flags.shipping_cancelled": true
                });
              }
            }
          } catch (emErr) {
            console.error("[cron] Error sending cancellation emails:", emErr.message);
          }
          processed++;
        } else {
          await docSnap.ref.update({
            refund_error: refundRes.status,
            refund_failed_at: now
          });
          try {
            await adminDb.collection("admin_alerts").add({
              type: "REFUND_FAILED",
              transaction_id: docSnap.id,
              status: refundRes.status,
              reason: "SELLER_NO_SHIPMENT",
              created_at: now
            });
            if (process.env.RESEND_API_KEY && resendClient2) {
              await resendClient2.emails.send({
                from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
                to: adminEmailAddress,
                subject: `Opozorilo: Neuspe\u0161no vra\u010Dilo kupnine za naro\u010Dilo ${docSnap.id}`,
                html: `<p>Vra\u010Dilo kupnine za naro\u010Dilo <strong>${docSnap.id}</strong> ni uspelo.</p><p>Status: ${refundRes.status}</p>`
              });
            }
          } catch (alertErr) {
            console.error("Failed to create admin alert for refund failure:", alertErr.message);
          }
        }
      }
    }
    res.json({ success: true, processed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
app.get("/api/cron/process-shipping-deadlines", handleProcessShippingDeadlines);
app.post("/api/cron/process-shipping-deadlines", handleProcessShippingDeadlines);
app.post("/api/orders/:id/verify-pickup-pin", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const { id } = req.params;
    const { pin } = req.body || {};
    if (!pin) return res.status(400).json({ error: "Manjka PIN." });
    const txRef = adminDb.collection("transactions").doc(id);
    const txDoc = await safeGetDoc(txRef);
    if (!txDoc.exists()) return res.status(404).json({ error: "Naro\u010Dilo ne obstaja." });
    const tx = txDoc.data();
    if (tx.seller_id !== userId) return res.status(403).json({ error: "Nimate pravic za to naro\u010Dilo." });
    if (tx.status !== "HELD_IN_ESCROW") return res.status(400).json({ error: "Naro\u010Dilo ni v stanju HELD_IN_ESCROW." });
    if (tx.pickup_pin !== pin) return res.status(400).json({ error: "Napa\u010Den PIN." });
    await txRef.update({
      status: "DELIVERED",
      delivered_at: (/* @__PURE__ */ new Date()).toISOString(),
      auto_complete_at: new Date(Date.now() + AUTO_COMPLETE_AFTER_DELIVERED_DAYS * 24 * 60 * 60 * 1e3).toISOString()
    });
    try {
      const sellerDoc = await safeGetDoc(adminDb.collection("users").doc(tx.seller_id));
      const seller = sellerDoc.data();
      const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(tx.auction_id));
      const auction = auctionDoc.data();
      if (seller?.email && process.env.RESEND_API_KEY) {
        const auctionTitleText = auction?.title?.SLO || auction?.title?.EN || "Predmet dra\u017Ebe";
        const baseAppUrl = process.env.APP_URL && !process.env.APP_URL.includes("drazbenik.si") ? process.env.APP_URL : "https://drazbe.eu";
        const auctionUrl = `${baseAppUrl}/?drazba=${tx.auction_id}`;
        const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuctionEmailTemplate, {
          type: "item_delivered_seller",
          recipientName: seller.first_name || seller.name || "prodajalec",
          auctionTitle: auctionTitleText,
          auctionImageUrl: auction?.images?.[0]?.url || auction?.images?.[0],
          currentPrice: tx.item_price,
          auctionUrl,
          settingsUrl: `${baseAppUrl}/?tab=settings`
        }));
        const resendClient3 = new import_resend2.Resend(process.env.RESEND_API_KEY);
        await resendClient3.emails.send({
          from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
          to: seller.email,
          subject: `Prevzem potrjen: ${auctionTitleText} - dra\u017Ebenik.si`,
          html: htmlContent
        });
      }
    } catch (emErr) {
      console.error("[verify-pickup-pin] Error sending email:", emErr.message);
    }
    res.json({ success: true, message: "Prevzem potrjen. Izpla\u010Dilo bo prodajalcu spro\u017Eeno samodejno po izteku roka za prito\u017Ebe." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/orders/:id/mark-as-shipped", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const { id } = req.params;
    const { carrier_name, tracking_number } = req.body || {};
    const txRef = adminDb.collection("transactions").doc(id);
    const txDoc = await safeGetDoc(txRef);
    if (!txDoc.exists()) return res.status(404).json({ error: "Naro\u010Dilo ne obstaja." });
    const tx = txDoc.data();
    if (tx.seller_id !== userId) return res.status(403).json({ error: "Nimate pravic." });
    if (tx.status !== "HELD_IN_ESCROW") return res.status(400).json({ error: "Napa\u010Dno stanje naro\u010Dila." });
    const amount = Number(tx.item_price ?? (tx.seller_net_cents ? tx.seller_net_cents / 100 : tx.amount_total));
    if (amount > 15 && !tracking_number) {
      return res.status(400).json({ error: "Za zneske nad 15 \u20AC je obvezen vnos sledilne \u0161tevilke." });
    }
    const buyerCc = tx.buyer_snapshot?.country_code || "SI";
    const sellerCc = tx.seller_snapshot?.country_code || "SI";
    const isCrossBorder = buyerCc !== "SI" || sellerCc !== "SI";
    const releaseDays = isCrossBorder ? AUTO_RELEASE_AFTER_SHIPPED_DAYS_CROSS_BORDER : AUTO_RELEASE_AFTER_SHIPPED_DAYS;
    const now = /* @__PURE__ */ new Date();
    const autoReleaseAt = new Date(now.getTime() + releaseDays * 24 * 60 * 60 * 1e3);
    await txRef.update({
      status: "SHIPPED",
      carrier_name: carrier_name || "Neznano",
      tracking_number: tracking_number || null,
      shipped_at: now.toISOString(),
      auto_release_at: autoReleaseAt.toISOString()
    });
    try {
      const buyerDoc = await safeGetDoc(adminDb.collection("users").doc(tx.buyer_id));
      const buyer = buyerDoc.data();
      const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(tx.auction_id));
      const auction = auctionDoc.data();
      if (buyer?.email && process.env.RESEND_API_KEY) {
        const auctionTitleText = auction?.title?.SLO || auction?.title?.EN || "Predmet dra\u017Ebe";
        const baseAppUrl = process.env.APP_URL && !process.env.APP_URL.includes("drazbenik.si") ? process.env.APP_URL : "https://drazbe.eu";
        const auctionUrl = `${baseAppUrl}/?drazba=${tx.auction_id}`;
        const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuctionEmailTemplate, {
          type: "item_shipped_buyer",
          recipientName: buyer.first_name || buyer.name || "kupec",
          auctionTitle: auctionTitleText,
          auctionImageUrl: auction?.images?.[0]?.url || auction?.images?.[0],
          currentPrice: tx.item_price,
          auctionUrl,
          settingsUrl: `${baseAppUrl}/?tab=settings`,
          carrierName: carrier_name,
          trackingNumber: tracking_number
        }));
        const resendClient3 = new import_resend2.Resend(process.env.RESEND_API_KEY);
        await resendClient3.emails.send({
          from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
          to: buyer.email,
          subject: `Va\u0161 predmet je bil poslan: ${auctionTitleText} - dra\u017Ebenik.si`,
          html: htmlContent
        });
      }
    } catch (emErr) {
      console.error("[mark-as-shipped] Error sending email:", emErr.message);
    }
    res.json({ success: true, message: "Ozna\u010Deno kot poslano." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/orders/:id/mark-as-delivered", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const { id } = req.params;
    const txRef = adminDb.collection("transactions").doc(id);
    const txDoc = await safeGetDoc(txRef);
    if (!txDoc.exists()) return res.status(404).json({ error: "Naro\u010Dilo ne obstaja." });
    const tx = txDoc.data();
    if (tx.buyer_id !== userId) return res.status(403).json({ error: "Nimate pravic." });
    if (tx.status !== "SHIPPED") return res.status(400).json({ error: "Naro\u010Dilo mora biti poslano." });
    const now = /* @__PURE__ */ new Date();
    const autoCompleteDate = new Date(now.getTime() + AUTO_COMPLETE_AFTER_DELIVERED_DAYS * 24 * 60 * 60 * 1e3);
    await txRef.update({
      status: "DELIVERED",
      delivered_at: now.toISOString(),
      auto_complete_at: autoCompleteDate.toISOString()
    });
    res.json({ success: true, message: "Ozna\u010Deno kot dostavljeno. Samodejna potrditev nastavljena na " + autoCompleteDate.toLocaleString() });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
var handleProcessEscrowCompletions = async (req, res) => {
  if (!requireCronSecret(req, res)) return;
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let processed = 0;
    const snapshotDelivered = await safeGetDocs(
      adminDb.collection("transactions").where("status", "==", "DELIVERED").where("auto_complete_at", "<=", now)
    );
    for (const docSnap of snapshotDelivered.docs) {
      const tx = docSnap.data();
      if (tx.status === "DISPUTED") continue;
      await docSnap.ref.update({
        status: "COMPLETED",
        completed_at: now
      });
      await releaseSellerPayout(docSnap.id, "auto_complete_delivered");
      processed++;
    }
    const heldSnap = await safeGetDocs(
      adminDb.collection("transactions").where("status", "==", "HELD_IN_ESCROW").where("auto_release_at", "<=", now)
    );
    const shippedSnap = await safeGetDocs(
      adminDb.collection("transactions").where("status", "==", "SHIPPED").where("auto_release_at", "<=", now)
    );
    const allToRelease = [...heldSnap.docs, ...shippedSnap.docs];
    for (const docSnap of allToRelease) {
      const tx = docSnap.data();
      if (tx.payout_status === "frozen" || tx.payout_status === "refunded") continue;
      await releaseSellerPayout(docSnap.id, "auto_deadline");
      processed++;
    }
    const waitingSnap = await safeGetDocs(
      adminDb.collection("transactions").where("payout_status", "==", "release_waiting_funds")
    );
    for (const docSnap of waitingSnap.docs) {
      await releaseSellerPayout(docSnap.id, "retry_waiting_funds");
      processed++;
    }
    const failedSnap = await safeGetDocs(
      adminDb.collection("transactions").where("payout_status", "==", "release_failed")
    );
    for (const docSnap of failedSnap.docs) {
      const tx = docSnap.data();
      if ((tx.payout_attempts || 0) >= PAYOUT_MAX_ATTEMPTS) {
        if (!tx.payout_failed_alert_sent && process.env.RESEND_API_KEY) {
          try {
            const resendFail = new import_resend2.Resend(process.env.RESEND_API_KEY);
            await resendFail.emails.send({
              from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
              to: adminEmailAddress,
              subject: "Izpla\u010Dilo prodajalcu ni uspelo",
              html: `<p>Izpla\u010Dilo za naro\u010Dilo <strong>${docSnap.id}</strong> ni uspelo ${tx.payout_attempts}-krat. Napaka: ${tx.payout_error || "neznana"}. Preverite prodajal\u010Dev Stripe ra\u010Dun.</p>`
            });
            await docSnap.ref.update({ payout_failed_alert_sent: true });
          } catch (failMailErr) {
            console.error("[cron] Admin alert for failed payout not sent:", failMailErr.message);
          }
        }
        continue;
      }
      if (tx.next_payout_attempt_at && tx.next_payout_attempt_at > now) continue;
      await releaseSellerPayout(docSnap.id, "retry_failed");
      processed++;
    }
    const holdAlertThreshold = new Date(Date.now() - HOLD_ALERT_DAYS * 24 * 60 * 60 * 1e3).toISOString();
    const holdAlertSnap = await safeGetDocs(
      adminDb.collection("transactions").where("held_since", "<=", holdAlertThreshold)
    );
    const holdHardThreshold = new Date(Date.now() - HOLD_HARD_LIMIT_DAYS * 24 * 60 * 60 * 1e3).toISOString();
    for (const docSnap of holdAlertSnap.docs) {
      const tx = docSnap.data();
      if (tx.payout_status === "paid_out" || tx.payout_status === "refunded") continue;
      const statusCheck = ["held", "frozen", "release_waiting_funds", "release_failed"].includes(tx.payout_status);
      if (!statusCheck) continue;
      const isHardLimit = tx.held_since <= holdHardThreshold;
      if (isHardLimit) {
        try {
          if (process.env.RESEND_API_KEY) {
            await resendClient2.emails.send({
              from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
              to: adminEmailAddress,
              subject: "KRITI\u010CNO: zadr\u017Eano izpla\u010Dilo pred potekom roka",
              html: `<p>Izpla\u010Dilo za naro\u010Dilo <strong>${docSnap.id}</strong> je zadr\u017Eano \u017Ee ve\u010D kot ${HOLD_HARD_LIMIT_DAYS} dni (od ${tx.held_since}).</p>
                     <p>Pribli\u017Euje se 90-dnevna \u010Dasovna omejitev Stripe za ro\u010Dna izpla\u010Dila!</p>
                     <p>Status izpla\u010Dila: ${tx.payout_status}. Znesek: ${tx.item_price} EUR.</p>`
            });
          }
        } catch (emErr) {
          console.error("[cron] Error sending hard limit admin email:", emErr.message);
        }
      } else {
        if (tx.hold_alert_sent === true) continue;
        try {
          if (process.env.RESEND_API_KEY) {
            await resendClient2.emails.send({
              from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
              to: adminEmailAddress,
              subject: `Opozorilo o zadr\u017Eanih sredstvih - Naro\u010Dilo ${docSnap.id}`,
              html: `<p>Izpla\u010Dilo za naro\u010Dilo <strong>${docSnap.id}</strong> je zadr\u017Eano ve\u0107 kot ${HOLD_ALERT_DAYS} dni (od ${tx.held_since}).</p>
                     <p>Pribli\u017Euje se 90-dnevna \u010Dasovna omejitev Stripe.</p>
                     <p>Status: ${tx.payout_status}. Znesek: ${tx.item_price} EUR.</p>`
            });
            await docSnap.ref.update({ hold_alert_sent: true });
          }
        } catch (emErr) {
          console.error("[cron] Error sending alert admin email:", emErr.message);
        }
      }
    }
    const reminderThreshold = new Date(Date.now() + PRE_RELEASE_BUYER_REMINDER_HOURS * 60 * 60 * 1e3).toISOString();
    const reminderSnap = await safeGetDocs(
      adminDb.collection("transactions").where("status", "==", "SHIPPED").where("auto_release_at", "<=", reminderThreshold)
    );
    for (const docSnap of reminderSnap.docs) {
      const tx = docSnap.data();
      if (tx.pre_release_reminder_sent === true) continue;
      try {
        const buyerDoc = await safeGetDoc(adminDb.collection("users").doc(tx.buyer_id));
        const buyer = buyerDoc.data();
        const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(tx.auction_id));
        const auction = auctionDoc.data();
        if (buyer?.email && process.env.RESEND_API_KEY) {
          const auctionTitleText = auction?.title?.SLO || auction?.title?.EN || "Predmet dra\u017Ebe";
          const baseAppUrl = process.env.APP_URL && !process.env.APP_URL.includes("drazbenik.si") ? process.env.APP_URL : "https://drazbe.eu";
          const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuctionEmailTemplate, {
            type: "item_delivered_buyer",
            recipientName: buyer.first_name || buyer.name || "kupec",
            auctionTitle: auctionTitleText,
            auctionImageUrl: auction?.images?.[0]?.url || auction?.images?.[0],
            currentPrice: tx.item_price,
            auctionUrl: `${baseAppUrl}/?drazba=${tx.auction_id}`,
            settingsUrl: `${baseAppUrl}/?tab=settings`
          }));
          const resendClient3 = new import_resend2.Resend(process.env.RESEND_API_KEY);
          await resendClient3.emails.send({
            from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
            to: buyer.email,
            subject: `Ste prejeli predmet? ${auctionTitleText} - dra\u017Ebenik.si`,
            html: htmlContent
          });
        }
        await docSnap.ref.update({ pre_release_reminder_sent: true });
      } catch (emErr) {
        console.error("[cron] Error sending pre-release reminder email:", emErr.message);
      }
    }
    res.json({ success: true, processed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
app.get("/api/cron/process-escrow-completions", handleProcessEscrowCompletions);
app.post("/api/cron/process-escrow-completions", handleProcessEscrowCompletions);
app.post("/api/orders/:id/open-dispute", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 1e3) {
      return res.status(400).json({ error: "Razlog za spor mora vsebovati med 10 in 1000 znakov." });
    }
    const trimmedReason = reason.trim();
    const txRef = adminDb.collection("transactions").doc(id);
    const txDoc = await safeGetDoc(txRef);
    if (!txDoc.exists()) return res.status(404).json({ error: "Naro\u010Dilo ne obstaja." });
    const tx = txDoc.data();
    if (tx.buyer_id !== userId) return res.status(403).json({ error: "Nimate pravic." });
    if (tx.status !== "SHIPPED" && tx.status !== "DELIVERED") {
      return res.status(400).json({ error: "Spor lahko odprete samo po tem, ko je izdelek poslan ali dostavljen." });
    }
    if (tx.status === "DELIVERED" && tx.auto_complete_at && new Date(tx.auto_complete_at) < /* @__PURE__ */ new Date()) {
      return res.status(400).json({ error: "Rok za odprtje spora je potekel (3 dni po dostavi)." });
    }
    await txRef.update({
      status: "DISPUTED",
      payout_status: "frozen",
      dispute_opened_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    await adminDb.collection("disputes").add({
      order_id: id,
      opened_by_user_id: userId,
      reason: trimmedReason,
      status: "OPEN",
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    res.json({ success: true, message: "Spor uspe\u0161no odprt." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/auth/verify-captcha", async (req, res) => {
  try {
    const { token, action } = req.body || {};
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      if (process.env.NODE_ENV !== "production") {
        return res.json({ success: true, score: 1 });
      }
      return res.status(503).json({ error: "reCAPTCHA ni nastavljen." });
    }
    if (!token) {
      return res.status(400).json({ error: "Manjka reCAPTCHA \u017Eeton." });
    }
    const params = new URLSearchParams();
    params.append("secret", secretKey);
    params.append("response", token);
    const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      body: params
    });
    const data = await verifyRes.json();
    if (!data.success) {
      return res.status(400).json({ error: "Preverjanje reCAPTCHA ni uspelo." });
    }
    if (action && data.action && data.action !== action) {
      return res.status(400).json({ error: "Neveljavno dejanje reCAPTCHA." });
    }
    const score = typeof data.score === "number" ? data.score : 1;
    if (score < 0.5) {
      return res.status(400).json({ error: "Zaznana je sumljiva aktivnost (nizka ocena reCAPTCHA)." });
    }
    return res.json({ success: true, score });
  } catch (err) {
    console.error("Error verifying reCAPTCHA:", err);
    return res.status(500).json({ error: err.message || "Napaka pri preverjanju reCAPTCHA." });
  }
});
function getAppBaseUrl(_req) {
  return process.env.APP_URL || "https://drazbe.eu";
}
app.post("/api/auth/send-email-change", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const userRecord = await adminAuth.getUser(userId);
    const currentEmail = (userRecord.email || "").trim().toLowerCase();
    const { newEmail, displayName } = req.body || {};
    if (!newEmail || typeof newEmail !== "string") {
      return res.status(400).json({ error: "Manjka nov e-po\u0161tni naslov." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanNewEmail = newEmail.trim().toLowerCase();
    if (!emailRegex.test(cleanNewEmail)) {
      return res.status(400).json({ error: "Neveljaven format novega e-po\u0161tnega naslova." });
    }
    if (cleanNewEmail === currentEmail) {
      return res.status(400).json({ error: "Nov e-po\u0161tni naslov mora biti druga\u010Den od trenutnega." });
    }
    try {
      const existingUser = await adminAuth.getUserByEmail(cleanNewEmail);
      if (existingUser && existingUser.uid !== userId) {
        return res.json({ success: true });
      }
    } catch (lookupErr) {
    }
    const baseAppUrl = getAppBaseUrl(req);
    const actionUrl = await adminAuth.generateVerifyAndChangeEmailLink(currentEmail, cleanNewEmail, {
      url: `${baseAppUrl}/?tab=settings`
    });
    if (process.env.RESEND_API_KEY) {
      const resend = new import_resend2.Resend(process.env.RESEND_API_KEY);
      const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuthEmailTemplate, {
        type: "verify_email",
        actionUrl,
        recipientName: displayName || userRecord.displayName || cleanNewEmail.split("@")[0]
      }));
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
        to: cleanNewEmail,
        subject: "Potrdite spremembo e-po\u0161tnega naslova - dra\u017Ebenik.si",
        html: htmlContent
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("send-email-change error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/auth/send-verification", async (req, res) => {
  try {
    const { email, displayName } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, error: "Manjka veljaven e-po\u0161tni naslov." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: "Manjka veljaven e-po\u0161tni naslov." });
    }
    let userRecord = null;
    try {
      userRecord = await adminAuth.getUserByEmail(cleanEmail);
    } catch (lookupErr) {
      return res.json({ success: true });
    }
    if (!userRecord || userRecord.emailVerified) {
      return res.json({ success: true });
    }
    const uid = userRecord.uid;
    const userEmail = userRecord.email || cleanEmail;
    const limitRef = adminDb.collection("email_verification_limits").doc(uid);
    let allowedToSend = false;
    await adminDb.runTransaction(async (t) => {
      const now2 = /* @__PURE__ */ new Date();
      const nowIso = now2.toISOString();
      const nowMs = now2.getTime();
      const limitSnap = await t.get(limitRef);
      if (!limitSnap.exists) {
        t.set(limitRef, {
          last_sent_at: nowIso,
          window_start: nowIso,
          count: 1
        });
        allowedToSend = true;
        return;
      }
      const limitData = limitSnap.data() || {};
      const lastSentMs = limitData.last_sent_at ? new Date(limitData.last_sent_at).getTime() : 0;
      if (nowMs - lastSentMs < 60 * 1e3) {
        allowedToSend = false;
        return;
      }
      let windowStartMs = limitData.window_start ? new Date(limitData.window_start).getTime() : 0;
      let count = typeof limitData.count === "number" ? limitData.count : 0;
      if (nowMs - windowStartMs >= 24 * 60 * 60 * 1e3) {
        windowStartMs = nowMs;
        count = 0;
        t.set(limitRef, {
          window_start: nowIso,
          last_sent_at: nowIso,
          count: 1
        }, { merge: true });
        allowedToSend = true;
        return;
      }
      if (count >= 5) {
        allowedToSend = false;
        return;
      }
      t.update(limitRef, {
        count: count + 1,
        last_sent_at: nowIso
      });
      allowedToSend = true;
    });
    if (!allowedToSend) {
      return res.json({ success: true });
    }
    const token = import_crypto.default.randomBytes(32).toString("hex");
    const now = /* @__PURE__ */ new Date();
    const expiresAt = Date.now() + 48 * 60 * 60 * 1e3;
    await adminDb.collection("email_verifications").doc(token).set({
      token,
      email: userEmail,
      userId: uid,
      created_at: now.toISOString(),
      expires_at: expiresAt,
      used: false
    });
    await adminDb.collection("users").doc(uid).set({
      verification_token: token,
      verification_token_expires: expiresAt
    }, { merge: true });
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const baseAppUrl = getAppBaseUrl(req);
      const actionUrl = `${baseAppUrl}/?verify_token=${token}&email=${encodeURIComponent(userEmail)}`;
      const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuthEmailTemplate, {
        type: "verify_email",
        actionUrl,
        recipientName: displayName || userRecord.displayName || userEmail.split("@")[0]
      }));
      const resend = new import_resend2.Resend(apiKey);
      const fromEmail = process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>";
      await resend.emails.send({
        from: fromEmail,
        to: userEmail,
        subject: "Potrdite svoj e-po\u0161tni naslov - dra\u017Ebenik.si",
        html: htmlContent
      });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("send-verification error:", err);
    return res.json({ success: true });
  }
});
app.post("/api/auth/confirm-email", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== "string") {
      return res.status(400).json({ success: false, error: "Manjka veljaven potrditveni \u017Eeton." });
    }
    const verificationRef = adminDb.collection("email_verifications").doc(token);
    let alreadyConfirmed = false;
    let isExpired = false;
    let targetUserId = "";
    let targetEmail = "";
    await adminDb.runTransaction(async (t) => {
      const snap = await t.get(verificationRef);
      if (!snap.exists) {
        throw new Error("TOKEN_NOT_FOUND");
      }
      const verification = snap.data() || {};
      targetUserId = verification.userId || "";
      targetEmail = verification.email || "";
      if (verification.used) {
        alreadyConfirmed = true;
        return;
      }
      if (verification.expires_at && verification.expires_at < Date.now()) {
        isExpired = true;
        return;
      }
      t.update(verificationRef, {
        used: true,
        confirmed_at: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
    if (alreadyConfirmed) {
      return res.json({
        success: true,
        alreadyConfirmed: true,
        message: "E-po\u0161tni naslov je bil \u017Ee predhodno potrjen.",
        email: targetEmail
      });
    }
    if (isExpired) {
      return res.status(400).json({ success: false, error: "Povezava za potrditev je potekla. Zahtevajte novo potrditveno povezavo." });
    }
    if (targetUserId) {
      await adminDb.collection("users").doc(targetUserId).set({
        email_verified: true,
        registration_confirmed: true,
        registration_confirmed_at: (/* @__PURE__ */ new Date()).toISOString(),
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true });
      try {
        await adminAuth.updateUser(targetUserId, { emailVerified: true });
      } catch (authErr) {
        console.warn("[confirm-email] adminAuth.updateUser notice:", authErr.message);
      }
    }
    return res.json({
      success: true,
      message: "E-po\u0161tni naslov je bil uspe\u0161no potrjen! Sedaj se lahko prijavite v svoj ra\u010Dun.",
      email: targetEmail
    });
  } catch (err) {
    if (err.message === "TOKEN_NOT_FOUND") {
      return res.status(400).json({ success: false, error: "Neveljaven ali neobstoje\u010D potrditveni \u017Eeton." });
    }
    console.error("confirm-email error:", err);
    return res.status(500).json({ success: false, error: err.message || "Napaka pri potrditvi e-po\u0161tnega naslova." });
  }
});
app.post("/api/auth/send-password-reset", async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Manjka veljaven e-po\u0161tni naslov." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = email.trim().toLowerCase();
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: "Manjka veljaven e-po\u0161tni naslov." });
    }
    if (!process.env.RESEND_API_KEY) {
      return res.json({
        success: false,
        fallbackToClient: true,
        message: "adminAuth ni na voljo za ponastavitev gesla, uporabi Firebase Client SDK."
      });
    }
    let userRecord = null;
    try {
      userRecord = await adminAuth.getUserByEmail(cleanEmail);
    } catch (e) {
      return res.json({ success: true });
    }
    if (!userRecord) {
      return res.json({ success: true });
    }
    let actionUrl = null;
    const baseAppUrl = getAppBaseUrl(req);
    try {
      actionUrl = await adminAuth.generatePasswordResetLink(cleanEmail, {
        url: `${baseAppUrl}/`
      });
    } catch (authErr) {
      return res.json({ success: true });
    }
    if (actionUrl) {
      try {
        const resend = new import_resend2.Resend(process.env.RESEND_API_KEY);
        const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuthEmailTemplate, {
          type: "reset_password",
          actionUrl,
          recipientName: userRecord.displayName || cleanEmail.split("@")[0]
        }));
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
          to: cleanEmail,
          subject: "Ponastavitev gesla - dra\u017Ebenik.si",
          html: htmlContent
        });
      } catch (sendErr) {
        console.error("send-password-reset send error:", sendErr);
        return res.json({ success: true });
      }
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("send-password-reset error:", err);
    return res.json({ success: true });
  }
});
app.post("/api/auth/send-email-changed", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const userRecord = await adminAuth.getUser(userId);
    const email = userRecord.email;
    if (!email) {
      return res.status(400).json({ error: "User has no email" });
    }
    const baseAppUrl = getAppBaseUrl(req);
    if (process.env.RESEND_API_KEY) {
      const resend = new import_resend2.Resend(process.env.RESEND_API_KEY);
      const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuthEmailTemplate, {
        type: "email_changed",
        actionUrl: `${baseAppUrl}/?tab=settings`,
        recipientName: userRecord.displayName || email.split("@")[0]
      }));
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
        to: email,
        subject: "Sprememba e-po\u0161tnega naslova - dra\u017Ebenik.si",
        html: htmlContent
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("send-email-changed error:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/auth/send-mfa-enrollment", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  try {
    const userRecord = await adminAuth.getUser(userId);
    const email = userRecord.email;
    if (!email) {
      return res.status(400).json({ error: "User has no email" });
    }
    const baseAppUrl = getAppBaseUrl(req);
    if (process.env.RESEND_API_KEY) {
      const resend = new import_resend2.Resend(process.env.RESEND_API_KEY);
      const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuthEmailTemplate, {
        type: "mfa_enrollment",
        actionUrl: `${baseAppUrl}/?tab=settings`,
        recipientName: userRecord.displayName || email.split("@")[0]
      }));
      await resend.emails.send({
        from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
        to: email,
        subject: "Varnostno obvestilo (MFA) - dra\u017Ebenik.si",
        html: htmlContent
      });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("send-mfa-enrollment error:", err);
    res.status(500).json({ error: err.message });
  }
});
var app_default = app;
var handleProcessSubscriptionRenewals = async (req, res) => {
  if (!requireCronSecret(req, res)) return;
  try {
    const now = /* @__PURE__ */ new Date();
    try {
      const cancelledUsers = await adminDb.collection("users").where("subscription_canceled", "==", true).get();
      for (const cDoc of cancelledUsers.docs) {
        const cUser = cDoc.data();
        if (cUser.subscription_valid_until) {
          if (now.getTime() >= new Date(cUser.subscription_valid_until).getTime()) {
            await cDoc.ref.set({
              subscription_tier: "FREE",
              subscription: "FREE",
              subscription_active: false,
              subscription_canceled: false
            }, { merge: true });
          }
        }
      }
    } catch (cErr) {
      console.warn("Napaka pri pregledu preklicanih naro\u010Dnin:", cErr.message);
    }
    const thirtyDaysAgo = /* @__PURE__ */ new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const usersSnapshot = await adminDb.collection("users").where("subscription_active", "==", true).where("subscription_paid_at", "<=", thirtyDaysAgo.toISOString()).get();
    let processed = 0;
    const stripe = getStripe();
    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      if (user.subscription_canceled === true) {
        continue;
      }
      const packageId = (user.subscription_tier || "").toLowerCase();
      let amountCents = 0;
      if (packageId.includes("pro")) amountCents = 5e3;
      else if (packageId.includes("basic")) amountCents = 2e3;
      else continue;
      const idempotencyKey = `renew_${doc.id}_${(/* @__PURE__ */ new Date()).getFullYear()}_${(/* @__PURE__ */ new Date()).getMonth()}`;
      const nextValidUntil = new Date(now);
      nextValidUntil.setMonth(nextValidUntil.getMonth() + 1);
      try {
        const txId = await reserveWalletFunds(doc.id, amountCents, "wallet_payment", idempotencyKey, { type: "subscription_renewal" });
        await commitReservedFunds(txId);
        await doc.ref.set({
          subscription_paid_at: now.toISOString(),
          subscription_started_at: now.toISOString(),
          subscription_cycle_started_at: now.toISOString(),
          subscription_valid_until: nextValidUntil.toISOString(),
          subscription_active: true
        }, { merge: true });
        createAndSendSubscriptionInvoice({
          userId: doc.id,
          packageId: user.subscription_tier || "BASIC",
          amountTotal: amountCents / 100,
          sourceId: txId,
          paymentMethod: "Dobroimetje v denarnici",
          periodStart: now,
          periodEnd: nextValidUntil
        }).catch((e) => console.error("[renewal-cron] Napaka pri ustvarjanju ra\u010Duna (denarnica):", e));
        processed++;
        continue;
      } catch (walletError) {
        if (walletError.message.includes("Idempotency key already exists")) {
          continue;
        }
        if (user.stripe_customer_id && user.stripe_default_payment_method) {
          try {
            await stripe.paymentIntents.create({
              amount: amountCents,
              currency: "eur",
              customer: user.stripe_customer_id,
              payment_method: user.stripe_default_payment_method,
              off_session: true,
              confirm: true,
              metadata: {
                type: "subscription",
                user_id: doc.id,
                package_id: user.subscription_tier,
                renewal: "true"
              }
            }, { idempotencyKey: `card_${idempotencyKey}` });
            await doc.ref.set({
              subscription_paid_at: now.toISOString(),
              subscription_started_at: now.toISOString(),
              subscription_cycle_started_at: now.toISOString(),
              subscription_valid_until: nextValidUntil.toISOString(),
              subscription_active: true
            }, { merge: true });
            createAndSendSubscriptionInvoice({
              userId: doc.id,
              packageId: user.subscription_tier || "BASIC",
              amountTotal: amountCents / 100,
              sourceId: `stripe_renew_${idempotencyKey}`,
              paymentMethod: "Spletno pla\u010Dilo / Kartica (Stripe)",
              periodStart: now,
              periodEnd: nextValidUntil
            }).catch((e) => console.error("[renewal-cron] Napaka pri ustvarjanju ra\u010Duna (kartica):", e));
            processed++;
          } catch (stripeError) {
            console.error(`Neuspe\u0161no podalj\u0161anje naro\u010Dnine s kartico za uporabnika ${doc.id}: `, stripeError);
            await doc.ref.set({
              subscription_active: false
            }, { merge: true });
          }
        } else {
          await doc.ref.set({
            subscription_active: false
          }, { merge: true });
        }
      }
    }
    res.json({ success: true, processed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
app.get("/api/cron/process-subscription-renewals", handleProcessSubscriptionRenewals);
app.post("/api/cron/process-subscription-renewals", handleProcessSubscriptionRenewals);
app.post("/api/cancel-subscription", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    if (!userData) {
      return res.status(404).json({ error: "User not found" });
    }
    if (userData.stripe_subscription_id) {
      const stripe = getStripe();
      await stripe.subscriptions.update(userData.stripe_subscription_id, {
        cancel_at_period_end: true
      });
    }
    await adminDb.collection("users").doc(userId).update({
      subscription_canceled: true
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Error in cancel-subscription:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/auctions/confirm-receipt", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const buyerId = decodedToken.uid;
    const { auction_id } = req.body;
    const txSnap = await safeGetDocs(
      adminDb.collection("transactions").where("auction_id", "==", auction_id)
    );
    if (txSnap.empty) {
      return res.status(404).json({ error: "Naro\u010Dilo ni najdeno." });
    }
    const txDoc = txSnap.docs[0];
    const tx = txDoc.data();
    if (tx.buyer_id !== buyerId) {
      return res.status(403).json({ error: "Nimate pravic za to dejanje." });
    }
    if (tx.status !== "SHIPPED" && tx.status !== "HELD_IN_ESCROW" && tx.status !== "DELIVERED") {
      return res.status(400).json({ error: "Naro\u010Dila v trenutnem stanju ni mogo\u010De potrditi." });
    }
    await txDoc.ref.update({
      status: "DELIVERED",
      delivered_at: (/* @__PURE__ */ new Date()).toISOString(),
      auto_complete_at: new Date(Date.now() + AUTO_COMPLETE_AFTER_DELIVERED_DAYS * 24 * 60 * 60 * 1e3).toISOString()
    });
    await adminDb.collection("auctions").doc(auction_id).update({
      buyer_received: true,
      received_at: (/* @__PURE__ */ new Date()).toISOString(),
      receipt_confirmed_at: (/* @__PURE__ */ new Date()).toISOString(),
      post_auction_status: "delivered"
    });
    await recordSaleCompletion(auction_id, tx.seller_id);
    try {
      const sellerDoc = await safeGetDoc(adminDb.collection("users").doc(tx.seller_id));
      const seller = sellerDoc.data();
      const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(auction_id));
      const auction = auctionDoc.data();
      if (seller?.email && process.env.RESEND_API_KEY) {
        const auctionTitleText = auction?.title?.SLO || auction?.title?.EN || "Predmet dra\u017Ebe";
        const baseAppUrl = process.env.APP_URL && !process.env.APP_URL.includes("drazbenik.si") ? process.env.APP_URL : "https://drazbe.eu";
        const auctionUrl = `${baseAppUrl}/?drazba=${auction_id}`;
        const htmlContent = await (0, import_render2.render)(import_react2.default.createElement(AuctionEmailTemplate, {
          type: "item_delivered_seller",
          recipientName: seller.first_name || seller.name || "prodajalec",
          auctionTitle: auctionTitleText,
          auctionImageUrl: auction?.images?.[0]?.url || auction?.images?.[0],
          currentPrice: tx.item_price,
          auctionUrl,
          settingsUrl: `${baseAppUrl}/?tab=settings`
        }));
        const resendClient3 = new import_resend2.Resend(process.env.RESEND_API_KEY);
        await resendClient3.emails.send({
          from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
          to: seller.email,
          subject: `Prejem potrjen: ${auctionTitleText} - dra\u017Ebenik.si`,
          html: htmlContent
        });
      }
    } catch (emErr) {
      console.error("[confirm-receipt] Error sending email:", emErr.message);
    }
    res.json({ success: true, message: "Prejem potrjen. Izpla\u010Dilo bo spro\u017Eeno samodejno \u010Dez 2 dni." });
  } catch (err) {
    console.error("Error in confirm-receipt:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/orders/payment-status", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const { auction_id } = req.query;
  if (!auction_id) return res.status(400).json({ error: "Missing auction_id" });
  try {
    const txSnap = await safeGetDocs(
      adminDb.collection("transactions").where("auction_id", "==", String(auction_id))
    );
    if (txSnap.empty) return res.status(404).json({ error: "Naro\u010Dilo ni bilo najdeno." });
    const tx = txSnap.docs[0].data();
    if (tx.buyer_id !== userId && tx.seller_id !== userId) {
      return res.status(403).json({ error: "Nimate pravic za ogled teh podatkov." });
    }
    const role = tx.buyer_id === userId ? "buyer" : "seller";
    const response = {
      status: tx.status,
      payout_status: tx.payout_status,
      delivery_method: tx.delivery_method,
      paid_at: tx.paid_at || tx.held_since,
      shipping_deadline: tx.shipping_deadline,
      shipped_at: tx.shipped_at,
      delivered_at: tx.delivered_at,
      auto_release_at: tx.auto_release_at,
      paid_out_at: tx.paid_out_at,
      refunded_at: tx.refunded_at,
      item_price: tx.item_price,
      platform_fee: tx.platform_fee,
      vat_amount: tx.vat_amount,
      amount_total: tx.amount_total,
      role
    };
    res.json(response);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post("/api/reviews/submit", async (req, res) => {
  let buyerId;
  try {
    buyerId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Niste prijavljeni." });
  }
  try {
    const { auction_id, rating, comment, would_recommend } = req.body || {};
    if (!auction_id || rating === void 0 || rating === null) {
      return res.status(400).json({ error: "Manjkajo\u010Di podatki za oceno." });
    }
    const numRating = Math.max(1, Math.min(5, Number(rating) || 5));
    const trimmedComment = typeof comment === "string" ? comment.trim() : "";
    let authorName = "Preverjen kupec";
    try {
      const buyerDoc = await safeGetDoc(adminDb.collection("users").doc(buyerId));
      if (buyerDoc.exists()) {
        const bData = buyerDoc.data() || {};
        if (bData.company_name) authorName = bData.company_name;
        else if (bData.first_name) authorName = `${bData.first_name} ${bData.last_name || ""}`.trim();
        else if (bData.username) authorName = bData.username;
        else if (bData.name) authorName = typeof bData.name === "object" ? bData.name.SLO || bData.name.EN : bData.name;
      }
    } catch (e) {
    }
    let actualSellerId = "";
    let reviewId = "";
    await adminDb.runTransaction(async (t) => {
      const aRef = adminDb.collection("auctions").doc(auction_id);
      const aDoc = await t.get(aRef);
      if (!aDoc.exists) {
        throw { status: 404, message: "Dra\u017Eba ni najdena." };
      }
      const auctionData = aDoc.data() || {};
      actualSellerId = auctionData.seller_id || auctionData.sellerId || auctionData.seller?.id;
      if (!actualSellerId) {
        throw { status: 400, message: "Prodajalec ni dolo\u010Den na dra\u017Ebi." };
      }
      if (buyerId === actualSellerId) {
        throw { status: 400, message: "Prodajalec ne more oceniti samega sebe." };
      }
      const winnerId = auctionData.winner_id || auctionData.winnerId;
      if (winnerId !== buyerId) {
        throw { status: 403, message: "Za oddajo ocene morate biti zmagovalec te dra\u017Ebe." };
      }
      const isPaid = auctionData.payment_status === "paid" || auctionData.post_auction_status === "paid";
      if (!isPaid) {
        throw { status: 400, message: "Oceno lahko oddate le za pla\u010Dane dra\u017Ebe." };
      }
      if (auctionData.review_submitted) {
        throw { status: 400, message: "Ocena je \u017Ee oddana." };
      }
      const auctionTitle = auctionData.title?.SLO || auctionData.title?.EN || (typeof auctionData.title === "string" ? auctionData.title : "Dra\u017Eba");
      const auctionImage = Array.isArray(auctionData.images) && auctionData.images.length > 0 ? auctionData.images[0] : null;
      const reviewRef = adminDb.collection("reviews").doc();
      reviewId = reviewRef.id;
      t.set(reviewRef, {
        seller_id: actualSellerId,
        sellerId: actualSellerId,
        author_id: buyerId,
        author: authorName,
        rating: numRating,
        comment: trimmedComment,
        auction_id,
        auctionId: auction_id,
        auction_title: auctionTitle,
        auction_image: auctionImage,
        date: (/* @__PURE__ */ new Date()).toLocaleDateString("sl-SI"),
        created_at: (/* @__PURE__ */ new Date()).toISOString(),
        isVerified: true,
        wouldRecommend: would_recommend !== void 0 ? Boolean(would_recommend) : numRating >= 4
      });
      t.update(aRef, {
        review_submitted: true,
        review_rating: numRating,
        review_comment: trimmedComment,
        review_submitted_at: (/* @__PURE__ */ new Date()).toISOString(),
        review_id: reviewId
      });
    });
    try {
      const sellerReviewsSnap = await adminDb.collection("reviews").where("seller_id", "==", actualSellerId).get();
      let totalRating = 0;
      let count = 0;
      sellerReviewsSnap.forEach((d) => {
        const rData = d.data();
        if (rData.rating) {
          totalRating += Number(rData.rating);
          count++;
        }
      });
      const avg = count > 0 ? Math.round(totalRating / count * 10) / 10 : numRating;
      await adminDb.collection("users").doc(actualSellerId).set({
        rating: avg,
        review_count: count,
        reviews_count: count
      }, { merge: true });
    } catch (statErr) {
      console.warn("Error updating seller stats in submit review:", statErr);
    }
    res.json({ success: true, review_id: reviewId });
  } catch (err) {
    if (err && typeof err === "object" && err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error("Error in /api/reviews/submit:", err);
    res.status(500).json({ error: err.message || "Napaka pri oddaji ocene." });
  }
});
app.get("/api/subscription/invoices", async (req, res) => {
  try {
    let authUid = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
        authUid = decoded.uid;
      } catch (e) {
      }
    }
    if (!authUid) {
      return res.status(401).json({ error: "Niste prijavljeni." });
    }
    const docsSnap = await safeGetDocs(
      adminDb.collection("documents").where("user_id", "==", authUid).where("type", "==", "subscription_invoice")
    );
    const invoices = docsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data()
    })).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    res.json({ invoices });
  } catch (err) {
    console.error("Error fetching subscription invoices:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/subscription/download-invoice/:invoiceNo", async (req, res) => {
  try {
    let authUid = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
        authUid = decoded.uid;
      } catch (e) {
      }
    }
    if (!authUid) {
      return res.status(401).json({ error: "Niste prijavljeni." });
    }
    const { invoiceNo } = req.params;
    const docSnap = await safeGetDocs(
      adminDb.collection("documents").where("invoice_no", "==", invoiceNo).where("user_id", "==", authUid).limit(1)
    );
    if (docSnap.empty) {
      return res.status(404).json({ error: "Ra\u010Dun ni bil najden." });
    }
    const docData = docSnap.docs[0].data();
    const invoicePath = docData.invoice_path || docData.file_url;
    if (!invoicePath) {
      return res.status(404).json({ error: "Ra\u010Dun ni shranjen v shrambi." });
    }
    let storagePath = invoicePath;
    if (storagePath.startsWith("http")) {
      try {
        storagePath = decodeURIComponent(storagePath.split("/o/")[1].split("?")[0]);
      } catch (e) {
      }
    }
    const storage = getAdminStorage();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "drazbesi.firebasestorage.app";
    const file = storage.bucket(bucketName).file(storagePath);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 10 * 60 * 1e3
      // 10 minutes
    });
    return res.json({ url });
  } catch (err) {
    console.error("Error generating subscription invoice download URL:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/invoices/download-url", async (req, res) => {
  try {
    let authUid = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
        authUid = decoded.uid;
      } catch (e) {
      }
    }
    if (!authUid) {
      return res.status(401).json({ error: "Niste prijavljeni." });
    }
    const { auction_id } = req.query;
    if (!auction_id || typeof auction_id !== "string") {
      return res.status(400).json({ error: "Manjka ID dra\u017Ebe." });
    }
    const auctionDoc = await safeGetDoc(adminDb.collection("auctions").doc(auction_id));
    if (!auctionDoc.exists) {
      return res.status(404).json({ error: "Dra\u017Eba ni bila najdena." });
    }
    const auction = auctionDoc.data() || {};
    const sellerId = auction.seller_id || auction.seller?.id;
    const winnerId = auction.winner_id || auction.winner?.id || auction.buyer_id;
    if (authUid !== sellerId && authUid !== winnerId) {
      return res.status(403).json({ error: "Nimate pravic za dostop do tega ra\u010Duna." });
    }
    const isPaid = auction.status === "completed" || auction.post_auction_status === "awaiting_buyer_receipt" || auction.post_auction_status === "buyer_received" || auction.is_paid;
    if (!isPaid) {
      return res.status(400).json({ error: "Dra\u017Eba \u0161e ni pla\u010Dana." });
    }
    const docsSnap = await safeGetDocs(
      adminDb.collection("documents").where("auction_id", "==", auction_id).where("type", "==", "invoice").limit(1)
    );
    let invoicePath = null;
    if (!docsSnap.empty) {
      const docData = docsSnap.docs[0].data();
      invoicePath = docData.invoice_path || docData.file_url;
    } else {
      const txSnap = await safeGetDocs(
        adminDb.collection("transactions").where("auction_id", "==", auction_id).limit(1)
      );
      if (!txSnap.empty) {
        const txId = txSnap.docs[0].id;
        const txDocsSnap = await safeGetDocs(
          adminDb.collection("documents").where("transaction_id", "==", txId).where("type", "==", "invoice").limit(1)
        );
        if (!txDocsSnap.empty) {
          invoicePath = txDocsSnap.docs[0].data().invoice_path || txDocsSnap.docs[0].data().file_url;
        }
      }
    }
    if (!invoicePath) {
      return res.status(404).json({ error: "Ra\u010Dun za to dra\u017Ebo ni na voljo." });
    }
    let storagePath = invoicePath;
    if (storagePath.startsWith("http")) {
      try {
        storagePath = decodeURIComponent(storagePath.split("/o/")[1].split("?")[0]);
      } catch (e) {
      }
    }
    const storage = getAdminStorage();
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "drazbesi.firebasestorage.app";
    const file = storage.bucket(bucketName).file(storagePath);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 10 * 60 * 1e3
      // 10 minutes
    });
    return res.json({ url });
  } catch (err) {
    console.error("Error generating invoice download URL:", err);
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/delete-account", async (req, res) => {
  try {
    let authUid = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
        authUid = decoded.uid;
      } catch (e) {
        return res.status(401).json({ error: "Neveljaven varnostni \u017Eeton." });
      }
    }
    if (!authUid) {
      return res.status(401).json({ error: "Niste prijavljeni." });
    }
    console.log(`[delete-account] Za\u010Denjam brisanje profila in podatkov za uporabnika: ${authUid}`);
    const sellerAuctions = await adminDb.collection("auctions").where("seller_id", "==", authUid).get();
    let batch = adminDb.batch();
    let batchCount = 0;
    for (const doc of sellerAuctions.docs) {
      const data = doc.data();
      const hasWinner = Boolean(data.winner_id || data.winnerId);
      const isCompleted = data.status === "completed" || data.payment_status === "paid" || data.post_auction_status === "paid";
      if (hasWinner || isCompleted) {
        batch.update(doc.ref, {
          is_seller_deleted: true,
          sellerName: "Uporabnik je bil izbrisan",
          seller: {
            id: authUid,
            is_deleted: true,
            name: { SLO: "Uporabnik je bil izbrisan", EN: "User deleted", DE: "Benutzer gel\xF6scht" },
            photoURL: null
          }
        });
        batchCount++;
      } else {
        batch.delete(doc.ref);
        batchCount++;
      }
      if (batchCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }
    const sellerAuctionsCamel = await adminDb.collection("auctions").where("sellerId", "==", authUid).get();
    for (const doc of sellerAuctionsCamel.docs) {
      if (sellerAuctions.docs.some((d) => d.id === doc.id)) continue;
      const data = doc.data();
      const hasWinner = Boolean(data.winner_id || data.winnerId);
      const isCompleted = data.status === "completed" || data.payment_status === "paid" || data.post_auction_status === "paid";
      if (hasWinner || isCompleted) {
        batch.update(doc.ref, {
          is_seller_deleted: true,
          sellerName: "Uporabnik je bil izbrisan",
          seller: {
            id: authUid,
            is_deleted: true,
            name: { SLO: "Uporabnik je bil izbrisan", EN: "User deleted", DE: "Benutzer gel\xF6scht" },
            photoURL: null
          }
        });
        batchCount++;
      } else {
        batch.delete(doc.ref);
        batchCount++;
      }
      if (batchCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }
    const notifications = await adminDb.collection("notifications").where("user_id", "==", authUid).get();
    for (const nDoc of notifications.docs) {
      batch.delete(nDoc.ref);
      batchCount++;
      if (batchCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }
    if (batchCount > 0) {
      await batch.commit();
    }
    try {
      const savedDocs = await adminDb.collection("saved_auctions").where("user_id", "==", authUid).get();
      if (!savedDocs.empty) {
        const sBatch = adminDb.batch();
        savedDocs.docs.forEach((d) => sBatch.delete(d.ref));
        await sBatch.commit();
      }
    } catch (sErr) {
    }
    await adminDb.collection("users").doc(authUid).set({
      id: authUid,
      is_deleted: true,
      isDeleted: true,
      username: "Uporabnik je bil izbrisan",
      company_name: "Uporabnik je bil izbrisan",
      first_name: "Izbrisan",
      last_name: "Uporabnik",
      name: { SLO: "Uporabnik je bil izbrisan", EN: "User deleted", DE: "Benutzer gel\xF6scht" },
      email: "",
      phone: "",
      address: "",
      street_address: "",
      city: "",
      postal_code: "",
      tax_id: "",
      registration_number: "",
      photoURL: null,
      photoUrl: null,
      photo_url: null,
      stripe_customer_id: null,
      stripe_default_payment_method: null,
      stripe_account_id: null,
      subscription_active: false,
      subscription_tier: "FREE",
      deleted_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: false });
    await syncPublicProfile(authUid);
    try {
      await adminAuth.deleteUser(authUid);
      console.log(`[delete-account] Uporabnik ${authUid} uspe\u0161no izbrisan iz Firebase Auth.`);
    } catch (authErr) {
      console.warn(`[delete-account] Opozorilo pri brisanju iz Firebase Auth:`, authErr.message);
    }
    console.log(`[delete-account] Uporabnik ${authUid} uspe\u0161no in varno izbrisan.`);
    res.json({ success: true, message: "Profil in podatki so bili uspe\u0161no izbrisani." });
  } catch (error) {
    console.error("[delete-account] Napaka pri brisanju profila:", error);
    res.status(500).json({ error: error.message || "Napaka pri brisanju profila." });
  }
});
app.post("/api/auctions/offer-second-chance", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Niste prijavljeni." });
  }
  try {
    const { auction_id } = req.body || {};
    if (!auction_id) {
      return res.status(400).json({ error: "Manjka ID dra\u017Ebe." });
    }
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(userId));
    const userData = userDoc.data() || {};
    if (userData.isBlocked) {
      return res.status(403).json({ error: "Va\u0161 ra\u010Dun je za\u010Dasno blokiran." });
    }
    try {
      await assertVerifiedUser(userId, userData);
    } catch (verErr) {
      return res.status(403).json({ error: verErr.message, code: verErr.code });
    }
    if (userData.stripe_onboarding_complete !== true) {
      return res.status(403).json({ error: "Za objavo dra\u017Ebe morate najprej urediti izpla\u010Dila.", code: "PAYOUTS_NOT_READY" });
    }
    if (auction_id) {
      await finalizeAuction(auction_id);
    }
    const auctionRef = adminDb.collection("auctions").doc(auction_id);
    const auctionDoc = await safeGetDoc(auctionRef);
    if (!auctionDoc.exists()) {
      return res.status(404).json({ error: "Dra\u017Eba ne obstaja." });
    }
    const auction = auctionDoc.data() || {};
    const sellerId = auction.seller_id || auction.sellerId;
    if (sellerId !== userId) {
      return res.status(403).json({ error: "Nimate pravic za to dejanje. Niste prodajalec te dra\u017Ebe." });
    }
    const rawEndTime = auction.end_time || auction.endTime;
    const isEnded = rawEndTime && new Date(rawEndTime).getTime() <= Date.now() || auction.status === "ended" || auction.status === "completed";
    if (!isEnded) {
      return res.status(400).json({ error: "Dra\u017Eba se \u0161e ni zaklju\u010Dila." });
    }
    if (auction.payment_status === "paid" || auction.post_auction_status === "paid") {
      return res.status(400).json({ error: "Ta dra\u017Eba je \u017Ee pla\u010Dana." });
    }
    const pas = auction.post_auction_status;
    const paymentDeadlineMs = auction.payment_deadline ? new Date(auction.payment_deadline).getTime() : 0;
    const isPaymentDeadlinePast = paymentDeadlineMs > 0 && paymentDeadlineMs <= Date.now();
    const isAllowedStatus = pas === "failed_1st" || pas === "unsold" || (pas === "awaiting_payment_1st" || pas === "pending_payment" || pas === "awaiting_payment" || !pas) && isPaymentDeadlinePast;
    if (!isAllowedStatus) {
      return res.status(400).json({ error: "Prvi zmagovalec ima \u0161e \u010Das za pla\u010Dilo." });
    }
    let topBids = [];
    try {
      const privDoc = await safeGetDoc(adminDb.collection("auctions_private").doc(auction_id));
      if (privDoc.exists()) {
        const privData = privDoc.data() || {};
        topBids = privData.top_bids || [];
      }
    } catch (privErr) {
      console.warn(`[OFFER 2ND CHANCE] Could not load auctions_private for ${auction_id}:`, privErr);
    }
    if (topBids.length < 2 && Array.isArray(auction.top_bids)) {
      topBids = auction.top_bids;
    }
    if (!topBids || topBids.length < 2) {
      return res.status(400).json({ error: "Ni 2. najvi\u0161jega ponudnika za to dra\u017Ebo." });
    }
    const secondBid = topBids[1];
    const secondWinnerId = secondBid.user_id || secondBid.userId;
    const secondAmount = Number(secondBid.amount || secondBid.bid || 0);
    if (!secondWinnerId || secondAmount <= 0) {
      return res.status(400).json({ error: "Podatki o 2. ponudniku niso veljavni." });
    }
    const now = /* @__PURE__ */ new Date();
    const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1e3).toISOString();
    await auctionRef.update({
      post_auction_status: "offered_2nd",
      second_winner_id: secondWinnerId,
      second_highest_bidder_id: secondWinnerId,
      second_chance_deadline: deadline,
      current_price: secondAmount,
      currentBid: secondAmount
    });
    res.json({
      success: true,
      message: "Dra\u017Eba je bila uspe\u0161no ponujena 2. najvi\u0161jemu ponudniku.",
      second_winner_id: secondWinnerId,
      second_chance_deadline: deadline,
      price: secondAmount
    });
  } catch (error) {
    console.error("[OFFER 2ND CHANCE ERROR]", error);
    res.status(500).json({ error: error.message || "Napaka pri ponujanju druge mo\u017Enosti." });
  }
});
app.post("/api/auctions/republish", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Niste prijavljeni." });
  }
  try {
    const { auction_id } = req.body || {};
    if (!auction_id) {
      return res.status(400).json({ error: "Manjka ID dra\u017Ebe." });
    }
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(userId));
    const userData = userDoc.data() || {};
    if (userData.isBlocked) {
      return res.status(403).json({ error: "Va\u0161 ra\u010Dun je za\u010Dasno blokiran." });
    }
    try {
      await assertVerifiedUser(userId, userData);
    } catch (verErr) {
      return res.status(403).json({ error: verErr.message, code: verErr.code });
    }
    if (userData.stripe_onboarding_complete !== true) {
      return res.status(403).json({ error: "Za objavo dra\u017Ebe morate najprej urediti izpla\u010Dila.", code: "PAYOUTS_NOT_READY" });
    }
    if (auction_id) {
      await finalizeAuction(auction_id);
    }
    const auctionRef = adminDb.collection("auctions").doc(auction_id);
    const auctionDoc = await safeGetDoc(auctionRef);
    if (!auctionDoc.exists()) {
      return res.status(404).json({ error: "Dra\u017Eba ne obstaja." });
    }
    const auction = auctionDoc.data() || {};
    const sellerId = auction.seller_id || auction.sellerId;
    if (sellerId !== userId) {
      return res.status(403).json({ error: "Nimate pravic za to dejanje. Niste prodajalec te dra\u017Ebe." });
    }
    const rawEndTime = auction.end_time || auction.endTime;
    const isEnded = rawEndTime && new Date(rawEndTime).getTime() <= Date.now() || auction.status !== "active";
    if (!isEnded && auction.status === "active") {
      return res.status(400).json({ error: "Dra\u017Eba je trenutno \u0161e aktivna in je ni mogo\u010De ponovno objaviti." });
    }
    if (auction.payment_status === "paid" || auction.post_auction_status === "paid") {
      return res.status(400).json({ error: "Pla\u010Dane dra\u017Ebe ni mogo\u010De ponovno objaviti." });
    }
    const pas = auction.post_auction_status;
    const nowMs = Date.now();
    if (pas === "awaiting_payment_1st" || pas === "pending_payment" || pas === "awaiting_payment" || pas === "awaiting_payment_2nd") {
      const pDeadlineMs = auction.payment_deadline ? new Date(auction.payment_deadline).getTime() : 0;
      if (pDeadlineMs > nowMs) {
        return res.status(400).json({ error: "Dra\u017Ebe ni mogo\u010De ponovno objaviti, dokler te\u010De rok za pla\u010Dilo." });
      }
    }
    if (pas === "offered_2nd") {
      const scDeadlineMs = auction.second_chance_deadline ? new Date(auction.second_chance_deadline).getTime() : 0;
      if (scDeadlineMs > nowMs) {
        return res.status(400).json({ error: "Dra\u017Ebe ni mogo\u010De ponovno objaviti, dokler te\u010De rok za sprejem druge mo\u017Enosti." });
      }
    }
    const originalCreated = new Date(auction.created_at || auction.createdAt || Date.now() - 7 * 24 * 60 * 60 * 1e3).getTime();
    const originalEnd = new Date(auction.end_time || auction.endTime || Date.now()).getTime();
    let durationMs = originalEnd - originalCreated;
    if (isNaN(durationMs) || durationMs <= 60 * 1e3) {
      durationMs = 7 * 24 * 60 * 60 * 1e3;
    }
    const now = /* @__PURE__ */ new Date();
    const newEndTime = new Date(now.getTime() + durationMs);
    const initialPrice = Number(auction.starting_price ?? auction.startingPrice ?? auction.start_price ?? auction.current_price ?? auction.currentBid ?? 1);
    await auctionRef.update({
      status: "active",
      created_at: now.toISOString(),
      createdAt: now.toISOString(),
      end_time: newEndTime.toISOString(),
      endTime: newEndTime.toISOString(),
      current_price: initialPrice,
      currentBid: initialPrice,
      starting_price: initialPrice,
      startingPrice: initialPrice,
      bid_count: 0,
      bidCount: 0,
      has_second_bidder: false,
      winner_id: null,
      winnerId: null,
      payment_status: "unpaid",
      post_auction_status: null,
      delivery_method: null,
      selected_delivery: null,
      paid_at: null,
      invoice_url: null,
      second_winner_id: null,
      second_highest_bidder_id: null,
      second_chance_deadline: null,
      reminder_30m_sent: false,
      reminder_end_sent: false,
      bidding_history: import_firestore.FieldValue.delete(),
      biddingHistory: import_firestore.FieldValue.delete(),
      top_bids: import_firestore.FieldValue.delete(),
      current_proxy_bid: import_firestore.FieldValue.delete(),
      currentProxyBid: import_firestore.FieldValue.delete(),
      hidden_max_bid: import_firestore.FieldValue.delete(),
      hiddenMaxBid: import_firestore.FieldValue.delete()
    });
    try {
      await adminDb.collection("auctions_private").doc(auction_id).delete();
    } catch (delPrivErr) {
      console.warn(`[REPUBLISH] Could not delete auctions_private/${auction_id}:`, delPrivErr.message);
    }
    try {
      const bidsRef = adminDb.collection("auctions").doc(auction_id).collection("bids");
      if (typeof adminDb.recursiveDelete === "function") {
        await adminDb.recursiveDelete(bidsRef);
      } else {
        const snap = await bidsRef.get();
        if (!snap.empty) {
          const batch = adminDb.batch();
          snap.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch (delBidsErr) {
      console.warn(`[REPUBLISH] Could not delete bids subcollection for ${auction_id}:`, delBidsErr.message);
    }
    res.json({
      success: true,
      message: "Dra\u017Eba je bila uspe\u0161no ponovno objavljena.",
      end_time: newEndTime.toISOString()
    });
  } catch (error) {
    console.error("[REPUBLISH ERROR]", error);
    res.status(500).json({ error: error.message || "Napaka pri ponovni objavi dra\u017Ebe." });
  }
});
app.post("/api/auctions/delete-unsold", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Niste prijavljeni." });
  }
  try {
    const { auction_ids } = req.body || {};
    if (!Array.isArray(auction_ids) || auction_ids.length === 0 || auction_ids.length > 30) {
      return res.status(400).json({ error: "Neveljavno \u0161tevilo dra\u017Eb za izbris (najve\u010D 30)." });
    }
    const nowMs = Date.now();
    const disallowedPending = ["awaiting_payment_1st", "offered_2nd", "awaiting_payment_2nd"];
    for (const id of auction_ids) {
      if (typeof id !== "string" || !id) {
        return res.status(400).json({ error: "Neveljaven ID dra\u017Ebe." });
      }
      const docRef = adminDb.collection("auctions").doc(id);
      const snap = await safeGetDoc(docRef);
      if (!snap.exists()) {
        return res.status(404).json({ error: `Dra\u017Eba ${id} ne obstaja.` });
      }
      const data = snap.data() || {};
      const sellerId = data.seller_id || data.sellerId;
      if (sellerId !== userId) {
        return res.status(403).json({ error: `Nimate pravic za izbris dra\u017Ebe ${id}. Niste prodajalec.` });
      }
      const rawEndTime = data.end_time || data.endTime;
      const isEnded = rawEndTime && new Date(rawEndTime).getTime() <= nowMs || data.status !== "active";
      if (!isEnded) {
        return res.status(400).json({ error: `Aktivne dra\u017Ebe (${id}) ni mogo\u010De izbrisati.` });
      }
      if (data.payment_status === "paid" || data.post_auction_status === "paid") {
        return res.status(400).json({ error: `Pla\u010Dane dra\u017Ebe (${id}) ni mogo\u010De izbrisati.` });
      }
      if (disallowedPending.includes(data.post_auction_status)) {
        return res.status(400).json({ error: `Dra\u017Ebe (${id}) s teko\u010Dim postopkom po koncu dra\u017Ebe ni mogo\u010De izbrisati.` });
      }
      const txSnap = await adminDb.collection("transactions").where("auction_id", "==", id).limit(1).get();
      if (!txSnap.empty) {
        return res.status(400).json({ error: `Dra\u017Ebe (${id}) z obstoje\u010Dimi transakcijami ni mogo\u010De izbrisati.` });
      }
    }
    for (const id of auction_ids) {
      await adminDb.collection("auctions").doc(id).delete();
      await adminDb.collection("auctions_private").doc(id).delete();
      try {
        const bidsRef = adminDb.collection("auctions").doc(id).collection("bids");
        if (typeof adminDb.recursiveDelete === "function") {
          await adminDb.recursiveDelete(bidsRef);
        } else {
          const snap = await bidsRef.get();
          if (!snap.empty) {
            const batch = adminDb.batch();
            snap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch (bErr) {
        console.warn(`[DELETE UNSOLD] Failed deleting bids subcollection for ${id}:`, bErr);
      }
    }
    res.json({ success: true, message: "Dra\u017Ebe so bile uspe\u0161no izbrisane." });
  } catch (error) {
    console.error("[DELETE UNSOLD ERROR]", error);
    res.status(500).json({ error: error.message || "Napaka pri izbrisu dra\u017Eb." });
  }
});
app.post("/api/auctions/set-delivery-method", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Niste prijavljeni." });
  }
  try {
    const { auction_id, delivery_method } = req.body || {};
    if (!auction_id || !delivery_method) {
      return res.status(400).json({ error: "Manjka ID dra\u017Ebe ali na\u010Din predaje." });
    }
    const validMethods = ["pickup", "post", "shipping"];
    if (!validMethods.includes(delivery_method)) {
      return res.status(400).json({ error: "Neveljaven na\u010Din predaje." });
    }
    const docRef = adminDb.collection("auctions").doc(auction_id);
    const snap = await safeGetDoc(docRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: "Dra\u017Eba ne obstaja." });
    }
    const data = snap.data() || {};
    const sellerId = data.seller_id || data.sellerId;
    if (sellerId !== userId) {
      return res.status(403).json({ error: "Na\u010Din predaje lahko nastavi le prodajalec te dra\u017Ebe." });
    }
    const isPaid = data.payment_status === "paid" || data.post_auction_status === "paid";
    if (!isPaid) {
      return res.status(400).json({ error: "Na\u010Din predaje je mogo\u010De nastaviti le za pla\u010Dane dra\u017Ebe." });
    }
    await docRef.update({
      delivery_method,
      selected_delivery: delivery_method
    });
    res.json({ success: true, message: "Na\u010Din predaje uspe\u0161no nastavljen." });
  } catch (error) {
    console.error("[SET DELIVERY METHOD ERROR]", error);
    res.status(500).json({ error: error.message || "Napaka pri nastavljanju na\u010Dina predaje." });
  }
});
app.post("/api/auctions/second-chance-respond", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Niste prijavljeni." });
  }
  try {
    const { auction_id, action } = req.body || {};
    if (!auction_id || !["accept", "reject"].includes(action)) {
      return res.status(400).json({ error: "Neveljavno dejanje ali manjka ID dra\u017Ebe." });
    }
    let resultMsg = "";
    await adminDb.runTransaction(async (t) => {
      const docRef = adminDb.collection("auctions").doc(auction_id);
      const snap = await t.get(docRef);
      if (!snap.exists) {
        throw { status: 404, message: "Dra\u017Eba ne obstaja." };
      }
      const data = snap.data() || {};
      const secondWinner = data.second_winner_id || data.second_highest_bidder_id;
      if (secondWinner !== userId) {
        throw { status: 403, message: "Nimate pravic za odziv na to ponudbo." };
      }
      if (data.post_auction_status !== "offered_2nd") {
        throw { status: 400, message: "Dra\u017Eba nima aktivne ponudbe druge mo\u017Enosti." };
      }
      const deadlineStr = data.second_chance_deadline;
      if (!deadlineStr || new Date(deadlineStr).getTime() <= Date.now()) {
        throw { status: 400, message: "Rok za sprejem druge mo\u017Enosti je potekel." };
      }
      if (action === "accept") {
        const paymentDeadline = new Date(Date.now() + 48 * 60 * 60 * 1e3).toISOString();
        t.update(docRef, {
          post_auction_status: "awaiting_payment_2nd",
          payment_deadline: paymentDeadline,
          winner_id: userId,
          winnerId: userId
        });
        resultMsg = "Sprejeli ste ponudbo za drugo mo\u017Enost. Imate 48 ur za pla\u010Dilo.";
      } else {
        t.update(docRef, {
          post_auction_status: "rejected_2nd"
        });
        resultMsg = "Zavrnili ste ponudbo druge mo\u017Enosti.";
      }
    });
    res.json({ success: true, message: resultMsg });
  } catch (error) {
    if (error && typeof error === "object" && error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error("[SECOND CHANCE RESPOND ERROR]", error);
    res.status(500).json({ error: error.message || "Napaka pri obdelavi odziva." });
  }
});
app.post("/api/auctions/archive", async (req, res) => {
  let userId;
  try {
    userId = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Niste prijavljeni." });
  }
  try {
    const { auction_id } = req.body || {};
    if (!auction_id) {
      return res.status(400).json({ error: "Manjka ID dra\u017Ebe." });
    }
    const docRef = adminDb.collection("auctions").doc(auction_id);
    const snap = await safeGetDoc(docRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: "Dra\u017Eba ne obstaja." });
    }
    const data = snap.data() || {};
    const sellerId = data.seller_id || data.sellerId;
    if (sellerId !== userId) {
      return res.status(403).json({ error: "Nimate pravic za arhiviranje te dra\u017Ebe. Niste prodajalec." });
    }
    const rawEndTime = data.end_time || data.endTime;
    const isEnded = rawEndTime && new Date(rawEndTime).getTime() <= Date.now() || data.status !== "active";
    if (!isEnded) {
      return res.status(400).json({ error: "Dra\u017Eba se \u0161e ni zaklju\u010Dila." });
    }
    if (data.payment_status === "paid" || data.post_auction_status === "paid") {
      return res.status(400).json({ error: "Pla\u010Dane dra\u017Ebe ni mogo\u010De arhivirati." });
    }
    await docRef.update({
      post_auction_status: "archived"
    });
    res.json({ success: true, message: "Dra\u017Eba premaknjena v arhiv." });
  } catch (error) {
    console.error("[ARCHIVE AUCTION ERROR]", error);
    res.status(500).json({ error: error.message || "Napaka pri arhiviranju dra\u017Ebe." });
  }
});
app.post("/api/profile/init", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";
    const emailVerified = Boolean(decodedToken.email_verified);
    const authProvider = decodedToken.firebase?.sign_in_provider || "password";
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      const { accepted_terms, terms_version } = req.body || {};
      if (accepted_terms !== true || terms_version !== TERMS_VERSION) {
        return res.status(400).json({ error: "Za registracijo morate sprejeti pogoje uporabe." });
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await userRef.set({
        id: uid,
        email,
        created_at: now,
        subscription: "FREE",
        subscription_tier: "FREE",
        profile_completed: false,
        identity_verified: false,
        email_verified: emailVerified,
        auth_provider: authProvider,
        terms_version: TERMS_VERSION,
        terms_accepted_at: now
      });
    } else {
      const updates = {};
      if (emailVerified) {
        updates.email_verified = true;
      }
      const existingData = userSnap.data() || {};
      if (!existingData.auth_provider) {
        updates.auth_provider = authProvider;
      }
      if (Object.keys(updates).length > 0) {
        await userRef.update(updates);
      }
    }
    await syncPublicProfile(uid);
    return res.json({ success: true, message: "Profil inicializiran." });
  } catch (err) {
    console.error("Error in /api/profile/init:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/profile/update", async (req, res) => {
  try {
    let uid;
    try {
      uid = await authenticateFirebaseUser(req);
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || "Unauthorized" });
    }
    const body = req.body || {};
    const cleanStr = (val, maxLen = 200) => {
      if (typeof val !== "string") return "";
      const trimmed = val.trim();
      return trimmed.length > maxLen ? trimmed.substring(0, maxLen) : trimmed;
    };
    const firstName = cleanStr(body.first_name || body.firstName);
    const lastName = cleanStr(body.last_name || body.lastName);
    const rawUsername = cleanStr(body.username || body.userName);
    const userType = (body.user_type || body.userType) === "business" ? "business" : "individual";
    const companyName = cleanStr(body.company_name || body.companyName);
    const companyStatus = cleanStr(body.company_status || body.companyStatus);
    const street = cleanStr(body.street_address || body.street || body.company_street || body.companyStreet);
    const postalCode = cleanStr(body.postal_code || body.postalCode || body.company_postal_code || body.companyPostalCode);
    const city = cleanStr(body.city || body.company_city || body.companyCity);
    const country = cleanStr(body.country || body.country_code || body.countryCode || "SI");
    const phone = cleanStr(body.phone || body.phoneNumber);
    const taxId = cleanStr(body.tax_id || body.tax_number || body.taxNumber || body.taxId);
    const vatId = cleanStr(body.vat_id || body.vatId);
    const regNumber = cleanStr(body.registration_number || body.regNumber);
    const description = cleanStr(body.description, 1e3);
    const language = cleanStr(body.language || "sl");
    const representative = cleanStr(body.representative);
    const autoInvoiceGen = body.auto_invoice_generation !== false && body.autoInvoiceGeneration !== false;
    const emailNotifs = typeof body.email_notifications === "object" ? body.email_notifications : typeof body.emailNotifications === "object" ? body.emailNotifications : void 0;
    const profilePictureUrl = cleanStr(body.profile_picture_url || body.profilePicture, 1e3);
    if (profilePictureUrl) {
      if (profilePictureUrl.startsWith("data:")) {
        return res.status(400).json({ error: "Profilna slika mora biti HTTPS povezava." });
      }
      if (!profilePictureUrl.startsWith("https://")) {
        return res.status(400).json({ error: "Profilna slika mora biti veljavna HTTPS povezava." });
      }
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || "drazbesi.firebasestorage.app";
      try {
        const parsedUrl = new URL(profilePictureUrl);
        if (parsedUrl.host !== "firebasestorage.googleapis.com") {
          return res.status(400).json({ error: "Profilna slika mora biti gostovana na firebasestorage.googleapis.com." });
        }
        if (!profilePictureUrl.includes(bucketName)) {
          return res.status(400).json({ error: "Profilna slika mora pripadati projektu drazba.si." });
        }
        const allowedProfEncoded = `profile-pictures%2F${uid}%2F`;
        const allowedProfDecoded = `profile-pictures/${uid}/`;
        if (!profilePictureUrl.includes(allowedProfEncoded) && !profilePictureUrl.includes(allowedProfDecoded)) {
          return res.status(400).json({ error: `Nalagate lahko le profilno sliko v svojo mapo (${allowedProfDecoded}).` });
        }
      } catch (e) {
        return res.status(400).json({ error: "Neveljaven URL profilne slike." });
      }
    }
    let validatedUsername = rawUsername;
    if (validatedUsername) {
      const usernameRegex = /^[a-zA-Z0-9._-]{3,30}$/;
      if (!usernameRegex.test(validatedUsername)) {
        return res.status(400).json({ error: "Uporabni\u0161ko ime lahko vsebuje le \u010Drke, \u0161tevilke, piko, pod\u010Drtaj in vezaj (3-30 znakov)." });
      }
      const lowerNewUsername = validatedUsername.toLowerCase();
      const currentUserDoc = await adminDb.collection("users").doc(uid).get();
      const currentData = currentUserDoc.data() || {};
      const oldUsername = (currentData.username || currentData.userName || "").trim();
      const lowerOldUsername = oldUsername.toLowerCase();
      if (lowerNewUsername !== lowerOldUsername) {
        try {
          await adminDb.runTransaction(async (transaction) => {
            const newUsernameRef = adminDb.collection("usernames").doc(lowerNewUsername);
            const newUsernameDoc = await transaction.get(newUsernameRef);
            if (newUsernameDoc.exists && newUsernameDoc.data()?.uid !== uid) {
              throw new Error("409_USERNAME_TAKEN");
            }
            transaction.set(newUsernameRef, { uid });
            if (lowerOldUsername) {
              const oldUsernameRef = adminDb.collection("usernames").doc(lowerOldUsername);
              transaction.delete(oldUsernameRef);
            }
          });
        } catch (txErr) {
          if (txErr.message === "409_USERNAME_TAKEN") {
            return res.status(409).json({ error: "To uporabni\u0161ko ime je \u017Ee zasedeno." });
          }
          throw txErr;
        }
      }
    }
    const rawVatStatus = cleanStr(body.vat_status || body.vatStatus);
    let vatStatus = "private";
    let finalVatId = "";
    if (userType === "business") {
      if (rawVatStatus === "payer") {
        vatStatus = "payer";
        finalVatId = vatId.toUpperCase().replace(/\s/g, "");
      } else {
        vatStatus = "exempt_small";
        finalVatId = "";
      }
    } else {
      vatStatus = "private";
      finalVatId = "";
    }
    let isProfileCompleted = Boolean(
      firstName && lastName && street && postalCode && city
    );
    if (userType === "business") {
      const hasVatStatus = vatStatus === "payer" || vatStatus === "exempt_small";
      const isVatIdValid = vatStatus !== "payer" || Boolean(finalVatId);
      isProfileCompleted = isProfileCompleted && Boolean(companyName && taxId && hasVatStatus && isVatIdValid);
    }
    const updatePayload = {
      first_name: firstName,
      firstName,
      last_name: lastName,
      lastName,
      username: validatedUsername,
      userName: validatedUsername,
      user_type: userType,
      userType,
      company_name: companyName,
      companyName,
      company_status: companyStatus,
      street_address: street,
      street,
      postal_code: postalCode,
      postalCode,
      city,
      country,
      country_code: country,
      countryCode: country,
      phone,
      phoneNumber: phone,
      tax_id: taxId,
      tax_number: taxId,
      taxNumber: taxId,
      taxId,
      vat_id: finalVatId,
      vatId: finalVatId,
      vat_status: vatStatus,
      vatStatus,
      registration_number: regNumber,
      regNumber,
      description,
      language,
      representative,
      auto_invoice_generation: autoInvoiceGen,
      autoInvoiceGeneration: autoInvoiceGen,
      profile_picture_url: profilePictureUrl || null,
      profilePicture: profilePictureUrl || null,
      profile_completed: isProfileCompleted,
      address: `${street}, ${postalCode} ${city}`.trim().replace(/^,|,$/g, "").trim(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (emailNotifs) {
      updatePayload.email_notifications = emailNotifs;
      updatePayload.emailNotifications = emailNotifs;
    }
    await adminDb.collection("users").doc(uid).set(updatePayload, { merge: true });
    await syncPublicProfile(uid);
    return res.json({
      success: true,
      message: "Profil uspe\u0161no posodobljen.",
      profile_completed: isProfileCompleted
    });
  } catch (err) {
    console.error("Error in /api/profile/update:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/accept-terms", async (req, res) => {
  let uid;
  try {
    uid = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const { terms_version } = req.body;
  if (terms_version !== TERMS_VERSION) return res.status(400).json({ error: "Invalid terms version" });
  await adminDb.collection("users").doc(uid).set({
    terms_version,
    terms_accepted_at: (/* @__PURE__ */ new Date()).toISOString()
  }, { merge: true });
  return res.json({ success: true });
});
app.post("/api/seller/accept-terms", async (req, res) => {
  let uid;
  try {
    uid = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const { terms_version, invoice_authorization, self_certification } = req.body;
  if (terms_version !== TERMS_VERSION || invoice_authorization !== true || self_certification !== true) {
    return res.status(400).json({ error: "Za nadaljevanje morate potrditi obe izjavi." });
  }
  await adminDb.collection("users").doc(uid).set({
    terms_version,
    terms_accepted_at: (/* @__PURE__ */ new Date()).toISOString(),
    seller_terms_version: TERMS_VERSION,
    seller_terms_accepted_at: (/* @__PURE__ */ new Date()).toISOString(),
    seller_invoice_authorization: true,
    seller_self_certified: true
  }, { merge: true });
  return res.json({ success: true });
});
app.post("/api/subscription/downgrade-free", async (req, res) => {
  try {
    let uid;
    try {
      uid = await authenticateFirebaseUser(req);
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || "Unauthorized" });
    }
    await adminDb.collection("users").doc(uid).set({
      subscription: "FREE",
      subscription_tier: "FREE",
      subscription_active: false,
      subscription_canceled: false,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    return res.json({ success: true, message: "Naro\u010Dnina spremenjena na Brezpla\u010Dni paket." });
  } catch (err) {
    console.error("Error in /api/subscription/downgrade-free:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/packages/publish", async (req, res) => {
  try {
    let uid;
    try {
      uid = await authenticateFirebaseUser(req);
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || "Unauthorized" });
    }
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(uid));
    const userData = userDoc.data() || {};
    if (userData.isBlocked) {
      return res.status(403).json({ error: "Va\u0161 ra\u010Dun je za\u010Dasno blokiran." });
    }
    try {
      await assertVerifiedUser(uid, userData);
    } catch (verErr) {
      return res.status(403).json({ error: verErr.message, code: verErr.code });
    }
    if (userData.stripe_onboarding_complete !== true) {
      return res.status(403).json({ error: "Za objavo dra\u017Ebe morate najprej urediti izpla\u010Dila.", code: "PAYOUTS_NOT_READY" });
    }
    const { package_id, title, auction_ids } = req.body || {};
    if (!package_id || !title || !Array.isArray(auction_ids) || auction_ids.length === 0) {
      return res.status(400).json({ error: "Neveljavni podatki paketa." });
    }
    for (const auctionId of auction_ids) {
      const auctionSnap = await adminDb.collection("auctions").doc(auctionId).get();
      if (!auctionSnap.exists) {
        return res.status(404).json({ error: `Dra\u017Eba ${auctionId} ne obstaja.` });
      }
      const auctionData = auctionSnap.data() || {};
      const sellerId = auctionData.seller_id || auctionData.sellerId;
      if (sellerId !== uid) {
        return res.status(403).json({ error: "Nimate pravic za te dra\u017Ebe." });
      }
    }
    const pkgRef = adminDb.collection("packages").doc(package_id);
    const existingPkg = await pkgRef.get();
    if (existingPkg.exists) {
      const existingData = existingPkg.data() || {};
      if (existingData.seller_id && existingData.seller_id !== uid) {
        return res.status(403).json({ error: "Paket pripada drugemu uporabniku." });
      }
    }
    await pkgRef.set({
      id: package_id,
      title,
      seller_id: uid,
      auction_ids,
      status: "active",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }, { merge: true });
    return res.json({ success: true, message: "Paket uspe\u0161no objavljen." });
  } catch (err) {
    console.error("Error in /api/packages/publish:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.get("/api/transactions/partner-info", async (req, res) => {
  try {
    let uid;
    try {
      uid = await authenticateFirebaseUser(req);
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || "Unauthorized" });
    }
    const auctionId = req.query.auction_id;
    if (!auctionId) {
      return res.status(400).json({ error: "Manjka auction_id." });
    }
    const auctionSnap = await adminDb.collection("auctions").doc(auctionId).get();
    if (!auctionSnap.exists) {
      return res.status(404).json({ error: "Dra\u017Eba ni najdena." });
    }
    const auction = auctionSnap.data() || {};
    const isPaid = auction.payment_status === "paid" || auction.post_auction_status === "paid" || auction.post_auction_status === "completed" || auction.status === "completed";
    if (!isPaid) {
      return res.status(400).json({ error: "Dra\u017Eba \u0161e ni pla\u010Dana." });
    }
    const sellerId = auction.seller_id || auction.sellerId;
    const buyerId = auction.winner_id || auction.winnerId;
    let partnerUid = null;
    if (uid === sellerId) {
      partnerUid = buyerId;
    } else if (uid === buyerId) {
      partnerUid = sellerId;
    } else {
      return res.status(403).json({ error: "Nimate pravic za ogled teh podatkov." });
    }
    if (!partnerUid) {
      return res.status(404).json({ error: "Podatki partnerja niso na voljo." });
    }
    const partnerSnap = await adminDb.collection("users").doc(partnerUid).get();
    if (!partnerSnap.exists) {
      return res.status(404).json({ error: "Partner ni najden." });
    }
    const pData = partnerSnap.data() || {};
    const partnerInfo = {
      id: partnerUid,
      first_name: pData.first_name || pData.firstName || "",
      firstName: pData.first_name || pData.firstName || "",
      last_name: pData.last_name || pData.lastName || "",
      lastName: pData.last_name || pData.lastName || "",
      username: pData.username || pData.userName || "",
      userName: pData.username || pData.userName || "",
      user_type: pData.user_type || pData.userType || "individual",
      userType: pData.user_type || pData.userType || "individual",
      company_name: pData.company_name || pData.companyName || "",
      companyName: pData.company_name || pData.companyName || "",
      company_status: pData.company_status || pData.companyStatus || "",
      companyStatus: pData.company_status || pData.companyStatus || "",
      street_address: pData.street_address || pData.street || "",
      street: pData.street_address || pData.street || "",
      city: pData.city || pData.company_city || pData.companyCity || "",
      postal_code: pData.postal_code || pData.postalCode || "",
      postalCode: pData.postal_code || pData.postalCode || "",
      country_code: pData.country_code || pData.countryCode || "SI",
      countryCode: pData.country_code || pData.countryCode || "SI",
      phone: pData.phone || pData.phoneNumber || "",
      phoneNumber: pData.phone || pData.phoneNumber || "",
      email: pData.email || "",
      tax_id: pData.tax_id || pData.tax_number || pData.taxNumber || pData.taxId || "",
      taxId: pData.tax_id || pData.tax_number || pData.taxNumber || pData.taxId || "",
      tax_number: pData.tax_id || pData.tax_number || pData.taxNumber || pData.taxId || "",
      taxNumber: pData.tax_id || pData.tax_number || pData.taxNumber || pData.taxId || "",
      vat_id: pData.vat_id || pData.vatId || "",
      vatId: pData.vat_id || pData.vatId || "",
      registration_number: pData.registration_number || pData.regNumber || "",
      regNumber: pData.registration_number || pData.regNumber || "",
      company_street: pData.company_street || pData.companyStreet || "",
      companyStreet: pData.company_street || pData.companyStreet || "",
      company_city: pData.company_city || pData.companyCity || "",
      companyCity: pData.company_city || pData.companyCity || "",
      company_postal_code: pData.company_postal_code || pData.companyPostalCode || "",
      companyPostalCode: pData.company_postal_code || pData.companyPostalCode || "",
      address: pData.address || "",
      representative: pData.representative || "",
      profile_picture_url: pData.profile_picture_url || pData.profilePicture || null,
      profilePicture: pData.profile_picture_url || pData.profilePicture || null,
      is_deleted: Boolean(pData.is_deleted || pData.isDeleted),
      isDeleted: Boolean(pData.is_deleted || pData.isDeleted)
    };
    return res.json({ success: true, partner: partnerInfo });
  } catch (err) {
    console.error("Error in /api/transactions/partner-info:", err);
    return res.status(500).json({ error: err.message });
  }
});
var chatRatelimit = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const chatRedis = new import_redis.Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
    chatRatelimit = new import_ratelimit.Ratelimit({
      redis: chatRedis,
      limiter: import_ratelimit.Ratelimit.slidingWindow(20, "1 m")
    });
  } catch (err) {
    console.warn("Failed to initialize chat rate limiter:", err);
  }
}
app.post("/api/messages/send", async (req, res) => {
  try {
    let uid;
    try {
      uid = await authenticateFirebaseUser(req);
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || "Unauthorized" });
    }
    const userDoc = await safeGetDoc(adminDb.collection("users").doc(uid));
    const userData = userDoc.data() || {};
    if (userData.isBlocked) {
      return res.status(403).json({ error: "Va\u0161 ra\u010Dun je za\u010Dasno blokiran." });
    }
    try {
      await assertVerifiedUser(uid, userData);
    } catch (verErr) {
      return res.status(403).json({ error: verErr.message, code: verErr.code });
    }
    const { auction_id, content: rawContent, image_url } = req.body;
    if (!auction_id) {
      return res.status(400).json({ error: "Manjka ID dra\u017Ebe (auction_id)." });
    }
    const auctionSnap = await adminDb.collection("auctions").doc(auction_id).get();
    if (!auctionSnap.exists) {
      return res.status(404).json({ error: "Dra\u017Eba ni bila najdena." });
    }
    const auctionData = auctionSnap.data() || {};
    const sellerId = auctionData.seller_id || auctionData.sellerId;
    const winnerId = auctionData.winner_id || auctionData.winnerId;
    if (uid !== sellerId && uid !== winnerId) {
      return res.status(403).json({ error: "Nimate dostopa do tega klepeta." });
    }
    const isPaid = auctionData.payment_status === "paid" || auctionData.post_auction_status === "paid" || auctionData.status === "completed";
    if (!isPaid) {
      return res.status(400).json({ error: "Klepet je mogo\u010D \u0161ele, ko je pla\u010Dilo uspe\u0161no izvedeno." });
    }
    const content = (rawContent || "").trim();
    const imageUrl = (image_url || "").trim();
    if (!content && !imageUrl) {
      return res.status(400).json({ error: "Sporo\u010Dilo mora vsebovati besedilo ali sliko." });
    }
    if (content && content.length > 2e3) {
      return res.status(400).json({ error: "Besedilo sporo\u010Dila je predolgo (najve\u010D 2000 znakov)." });
    }
    if (imageUrl) {
      if (!imageUrl.startsWith("https://firebasestorage.googleapis.com/") && !imageUrl.startsWith("https://storage.googleapis.com/")) {
        return res.status(400).json({ error: "Naslov slike mora biti veljaven HTTPS naslov v Firebase ali Google Storage." });
      }
      if (imageUrl.length > 1e3) {
        return res.status(400).json({ error: "Naslov slike je predolg (najve\u010D 1000 znakov)." });
      }
      if (imageUrl.startsWith("data:")) {
        return res.status(400).json({ error: "Neposredno Base64 nalaganje (data: URL) ni dovoljeno." });
      }
    }
    if (chatRatelimit) {
      try {
        const { success } = await chatRatelimit.limit(`chat_limit_${uid}`);
        if (!success) {
          return res.status(429).json({ error: "Presegli ste omejitev po\u0161iljanja sporo\u010Dil. Poskusite ponovno \u010Dez eno minuto." });
        }
      } catch (limErr) {
        console.warn("Upstash limit check failed, bypassing:", limErr);
      }
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const recipientId = uid === sellerId ? winnerId : sellerId;
    const conversationId = "conv_" + auction_id;
    const batch = adminDb.batch();
    const msgRef = adminDb.collection("messages").doc();
    const convRef = adminDb.collection("conversations").doc(conversationId);
    const msgData = {
      conversation_id: conversationId,
      auction_id,
      sender_id: uid,
      recipient_id: recipientId,
      participants: [sellerId, winnerId],
      content,
      is_read: false,
      created_at: nowIso
    };
    if (imageUrl) {
      msgData.image_url = imageUrl;
    }
    batch.set(msgRef, msgData);
    const lastMsgText = content ? content.substring(0, 200) : "[Slika]";
    const convData = {
      id: conversationId,
      auction_id,
      participant_one: sellerId,
      participant_two: winnerId,
      participants: [sellerId, winnerId],
      last_message: lastMsgText,
      last_message_at: nowIso,
      updated_at: nowIso,
      [`unread_counts.${recipientId}`]: import_firestore.FieldValue.increment(1)
    };
    batch.set(convRef, convData, { merge: true });
    await batch.commit();
    return res.json({ id: msgRef.id, created_at: nowIso });
  } catch (err) {
    console.error("Error in /api/messages/send:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/messages/mark-read", async (req, res) => {
  try {
    let uid;
    try {
      uid = await authenticateFirebaseUser(req);
    } catch (authErr) {
      return res.status(401).json({ error: authErr.message || "Unauthorized" });
    }
    const { conversation_id } = req.body;
    if (!conversation_id) {
      return res.status(400).json({ error: "Manjka ID pogovora (conversation_id)." });
    }
    const convRef = adminDb.collection("conversations").doc(conversation_id);
    const convSnap = await convRef.get();
    if (!convSnap.exists) {
      return res.status(404).json({ error: "Pogovor ni bil najden." });
    }
    const convData = convSnap.data() || {};
    const participants = convData.participants || [];
    if (!participants.includes(uid)) {
      return res.status(403).json({ error: "Nimate dostopa do tega pogovora." });
    }
    const batch = adminDb.batch();
    batch.set(convRef, {
      unread_counts: {
        [uid]: 0
      }
    }, { merge: true });
    const unreadMsgsSnap = await adminDb.collection("messages").where("conversation_id", "==", conversation_id).where("recipient_id", "==", uid).where("is_read", "==", false).limit(400).get();
    unreadMsgsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { is_read: true });
    });
    await batch.commit();
    return res.json({ success: true, marked_count: unreadMsgsSnap.size });
  } catch (err) {
    console.error("Error in /api/messages/mark-read:", err);
    return res.status(500).json({ error: err.message });
  }
});
var finalizeRatelimit = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    const redis = new import_redis.Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
    finalizeRatelimit = new import_ratelimit.Ratelimit({
      redis,
      limiter: import_ratelimit.Ratelimit.slidingWindow(30, "1 m")
    });
  } catch (err) {
    console.warn("Failed to initialize finalize rate limiter:", err);
  }
}
async function checkFinalizeRateLimit(uid) {
  if (finalizeRatelimit) {
    try {
      const { success } = await finalizeRatelimit.limit(`finalize_limit_${uid}`);
      return success;
    } catch (e) {
      console.warn("Upstash limit check failed, falling back to Firestore:", e);
    }
  }
  try {
    const limitRef = adminDb.collection("user_rate_limits").doc(uid);
    const limitSnap = await limitRef.get();
    const now = Date.now();
    const limitData = limitSnap.exists ? limitSnap.data() || {} : {};
    const timestamp = limitData.finalize_ts || 0;
    let count = limitData.finalize_cnt || 0;
    if (now - timestamp > 60 * 1e3) {
      count = 0;
    }
    if (count >= 30) return false;
    const updates = {};
    if (count === 0) updates.finalize_ts = now;
    updates.finalize_cnt = count + 1;
    await limitRef.set(updates, { merge: true });
    return true;
  } catch (fsErr) {
    return true;
  }
}
app.post("/api/auctions/finalize", async (req, res) => {
  let uid;
  try {
    uid = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const allowed = await checkFinalizeRateLimit(uid);
  if (!allowed) {
    return res.status(429).json({ error: "Presegli ste omejitev klicev za zaklju\u010Devanje dra\u017Eb. Poskusite ponovno \u010Dez minuto." });
  }
  const { auction_id } = req.body || {};
  if (!auction_id) {
    return res.status(400).json({ error: "Manjka ID dra\u017Ebe (auction_id)." });
  }
  try {
    const result = await finalizeAuction(auction_id);
    return res.json({
      finalized: !!result.finalized,
      post_auction_status: result.post_auction_status || null,
      status: result.status || null
    });
  } catch (err) {
    console.error("Error in /api/auctions/finalize:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/admin/orders/:id/resolve-dispute", async (req, res) => {
  let uid;
  try {
    uid = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const adminUids = (process.env.ADMIN_UIDS || "admin,owner").split(",").map((s) => s.trim()).filter(Boolean);
  if (!adminUids.includes(uid) && uid !== "admin" && uid !== "owner") {
    return res.status(403).json({ error: "Nimate administratorskih pravic." });
  }
  try {
    const { id } = req.params;
    const { decision, note } = req.body || {};
    if (decision !== "release_to_seller" && decision !== "refund_buyer") {
      return res.status(400).json({ error: "Invalid decision value." });
    }
    const txRef = adminDb.collection("transactions").doc(id);
    const txDoc = await safeGetDoc(txRef);
    if (!txDoc.exists()) {
      return res.status(404).json({ error: "Naro\u010Dilo ne obstaja." });
    }
    const tx = txDoc.data();
    if (tx.status !== "DISPUTED") {
      return res.status(400).json({ error: "Naro\u010Dilo ni v sporu." });
    }
    const stripe = getStripe();
    const resendClient3 = new import_resend2.Resend(process.env.RESEND_API_KEY);
    if (decision === "release_to_seller") {
      await txRef.update({
        payout_status: "held",
        admin_dispute_decision: "release_to_seller",
        admin_dispute_note: note || ""
      });
      const resPay = await releaseSellerPayout(id, "admin_release");
      if (!resPay.ok && resPay.status === "release_waiting_funds") {
      }
    } else if (decision === "refund_buyer") {
      if (!tx.stripe_payment_intent_id) {
        return res.status(400).json({ error: "Naro\u010Dilo nima povezanega pla\u010Dilnega ID (payment_intent_id)." });
      }
      const refundRes = await refundTransactionToBuyer(id, "admin_dispute_refund");
      if (!refundRes.ok) {
        return res.status(500).json({ error: "Fehler bei der R\xFCckerstattung: " + refundRes.status });
      }
      await txRef.update({
        admin_dispute_decision: "refund_buyer",
        admin_dispute_note: note || ""
      });
      await adminDb.collection("auctions").doc(tx.auction_id || "").update({
        payment_status: "refunded",
        post_auction_status: "refunded",
        status: "canceled"
      });
    }
    try {
      if (process.env.RESEND_API_KEY) {
        const buyerDoc = await safeGetDoc(adminDb.collection("users").doc(tx.buyer_id));
        const buyer = buyerDoc.data() || {};
        if (buyer.email) {
          await resendClient3.emails.send({
            from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
            to: buyer.email,
            subject: `Razre\u0161itev spora za naro\u010Dilo - dra\u017Ebenik.si`,
            html: `<p>Pozdravljeni,</p>
                   <p>Spor glede va\u0161ega naro\u010Dila <strong>${id}</strong> je bil razre\u0161en.</p>
                   <p><strong>Odlo\u010Ditev:</strong> ${decision === "refund_buyer" ? "Vra\u010Dilo kupcu (vam)." : "Sredstva spro\u0161\u010Dena prodajalcu."}</p>
                   <p>Opomba administratorja: ${note || "/"}</p>`
          });
        }
        const sellerDoc = await safeGetDoc(adminDb.collection("users").doc(tx.seller_id));
        const seller = sellerDoc.data() || {};
        if (seller.email) {
          await resendClient3.emails.send({
            from: process.env.EMAIL_FROM || "dra\u017Ebenik.si <obvestila@drazbenik.si>",
            to: seller.email,
            subject: `Razre\u0161itev spora za naro\u010Dilo - dra\u017Ebenik.si`,
            html: `<p>Pozdravljeni,</p>
                   <p>Spor glede va\u0161ega prodanega predmeta v naro\u010Dilu <strong>${id}</strong> je bil razre\u0161en.</p>
                   <p><strong>Odlo\u010Ditev:</strong> ${decision === "refund_buyer" ? "Vra\u010Dilo kupcu." : "Izpla\u010Dilo spro\u0161\u010Deno prodajalcu (vam)."}</p>
                   <p>Opomba administratorja: ${note || "/"}</p>`
          });
        }
      }
    } catch (emErr) {
      console.error("[resolve-dispute] Error sending notification emails:", emErr.message);
    }
    try {
      const disputesSnap = await adminDb.collection("disputes").where("order_id", "==", id).get();
      for (const dDoc of disputesSnap.docs) {
        await dDoc.ref.update({
          status: "RESOLVED",
          decision,
          resolved_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    } catch (dispErr) {
      console.error("[resolve-dispute] Error updating disputes collection:", dispErr.message);
    }
    return res.json({ success: true, message: "Streitfall erfolgreich gel\xF6st." });
  } catch (err) {
    console.error("Error resolving dispute:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.post("/api/admin/run-cron", async (req, res) => {
  let uid;
  try {
    uid = await authenticateFirebaseUser(req);
  } catch (authErr) {
    return res.status(401).json({ error: authErr.message || "Unauthorized" });
  }
  const adminUids = (process.env.ADMIN_UIDS || "admin,owner").split(",").map((s) => s.trim()).filter(Boolean);
  if (!adminUids.includes(uid) && uid !== "admin" && uid !== "owner") {
    return res.status(403).json({ error: "Nimate administratorskih pravic." });
  }
  try {
    const result = await processAuctionCrons();
    return res.json(result);
  } catch (err) {
    console.error("Error in /api/admin/run-cron:", err);
    return res.status(500).json({ error: err.message });
  }
});
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found on Vercel backend", url: req.url, originalUrl: req.originalUrl });
});
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  app,
  recordSaleCompletion
});
