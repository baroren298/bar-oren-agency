/*
 * /admin/login — Phase 2: Auth/Security.
 *
 * Server component shell; the interactive form is a client component
 * (LoginForm) since it needs fetch + local state. middleware.js explicitly
 * allow-lists this path so it's reachable without a session — everything
 * else under /admin requires one (see middleware.js for the allow-list).
 */

import LoginForm from './LoginForm';

export const metadata = {
  title: 'כניסת מנהל — Admin',
};

export default function LoginPage() {
  return <LoginForm />;
}
