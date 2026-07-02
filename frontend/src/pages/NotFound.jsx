// ============================================================
// NOT FOUND PAGE — Phase 8
// ============================================================
// Catch-all for unmatched routes. Previously there was no route
// for this, so a typo'd URL just rendered a blank page.
// ============================================================
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';

export default function NotFound() {
  const { isAuthenticated } = useApp();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
      <Compass size={32} className="text-brand mb-4" />
      <h1 className="text-2xl font-semibold mb-2">Page not found</h1>
      <p className="text-muted-text max-w-sm mb-6">
        There's nothing at this address. Double-check the link, or head back to
        somewhere that exists.
      </p>
      <Link to={isAuthenticated ? '/dashboard' : '/'} className="btn-primary">
        {isAuthenticated ? 'Go to dashboard' : 'Go home'}
      </Link>
    </div>
  );
}
