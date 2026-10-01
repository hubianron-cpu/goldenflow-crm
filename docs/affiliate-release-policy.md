# Affiliate disclosure and operational gates

Status: proposed wording, NOT user/legal approval and NOT published. CRM only.

## Proposed public disclosure (Hebrew)

כאשר מגיעים ל־GoldenFlow CRM דרך קישור שותף, ואם מעקב השותפים הופעל,
נשמר בדפדפן מזהה הפניה בעוגייה למשך עד 30 יום ממועד ההפניה המקורי.
המזהה משמש לשיוך ההרשמה ולזיהוי תשלום ראשון מאומת בתוך חלון השיוך.
במערכת נשמרים קוד השותף, מזהה ההפניה, מועדי ההפניה והתפוגה, ולאחר הרשמה
גם מזהה החשבון. במקרה של המרה נשמרים מזהה העסקה, סכומה ומועד ההמרה.
חלון השיוך אינו תקופת מחיקת הרשומות; שמירת המידע כפופה למדיניות הפרטיות
ולנוהל השמירה והמחיקה. השיוך אינו מפעיל תשלום עמלה אוטומטי.

## Approval needed before activation

- Ron must explicitly approve the wording and placement in the public privacy/
  registration flow; a reviewer must determine applicable cookie consent needs.
- Do not promise automatic deletion at 30 days: the current migration does not
  implement expiry cleanup. Decide retention/cleanup separately before publishing
  any fixed retention promise.
- The current release implements server-side attribution, not partner data export
  or commission payout. Any future partner report requires a separate data-sharing
  review and minimal-field access policy.

## Manual reconciliation

Before a commission is approved, compare the recorded first transaction, amount,
account attribution and date with the payment provider's confirmed transaction.
Check refunds, chargebacks and cancellation separately. A recorded conversion is a
candidate, not proof that a commission is payable. Record the decision, reviewer,
date and reason; do not invent or automatically mutate a refunded conversion.
No commission percentage, payout schedule or refund feed is implemented by PR #34.

## Rollout gates

Keep AFFILIATE_TRACKING_ENABLED OFF until disclosure/operations approval and click
limiter migration/tests pass. Apply the limiter after affiliate_referrals exists,
before the updated click route is deployed. Validate the Production schema, grants
and legacy Grow event compatibility read-only before requesting migration/merge
approval. A missing atomic Grow RPC affects all payments even with attribution OFF.

The public route's shared cap (60 new clicks/minute, 500/hour per partner) bounds
row creation without storing IP. Existing valid cookies bypass creation, not expiry.
The cap can deny legitimate new attribution during abuse; monitoring/edge protection
may be required before increasing limits. Server service_role access can still write
directly; never expose that key as a client-side abuse-control substitute.
