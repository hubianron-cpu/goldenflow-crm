type QaUser = { id?: string; email?: string | null; app_metadata?: Record<string, unknown> } | null;

export function isClosureQaRuntime(env: NodeJS.ProcessEnv): boolean;
export function isClosureQaUser(user: QaUser): boolean;
export function isClosureQaRequest(origin: string | null, requestUrl: string, confirmation: unknown, email: string): boolean;
