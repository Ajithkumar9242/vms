import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

/**
 * Wraps protected routes — redirects to /login if not authenticated.
 */
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * Role-based route guard.
 * Usage: <RoleRoute roles={['admin', 'super_admin']}><Page /></RoleRoute>
 * Redirects to Dashboard if user lacks the required role.
 */
export const RoleRoute = ({ roles, children }) => {
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role || '';

  if (!roles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

/**
 * Wraps the login page — redirects to / if already authenticated.
 */
export const PublicRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
