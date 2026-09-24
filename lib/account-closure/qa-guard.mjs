const STAGING_URL = "https://pzxwaoghixsqcstfrorn.supabase.co";
const QA_BRANCH = "codex/crm-deletion-combined-qa";
const QA_EMAIL = /^hubianron\+crm-closure-qa-[a-z0-9]+@gmail\.com$/;

export function isClosureQaRuntime(env) {
  return env.VERCEL_ENV === "preview"
    && env.VERCEL_GIT_COMMIT_REF === QA_BRANCH
    && env.NEXT_PUBLIC_SUPABASE_URL === STAGING_URL
    && env.CRM_ACCOUNT_DELETION_QA === "synthetic-staging-only";
}

export function isClosureQaUser(user) {
  return Boolean(user?.id && typeof user.email === "string"
    && QA_EMAIL.test(user.email.toLowerCase())
    && user.app_metadata?.crm_closure_qa === true);
}

export function isClosureQaRequest(origin, requestUrl, confirmation, email) {
  return typeof origin === "string"
    && origin === new URL(requestUrl).origin
    && confirmation === email;
}
