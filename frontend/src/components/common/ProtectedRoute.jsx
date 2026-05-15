import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/store/authStore';

export const getRoleHome = (role) => {
  if (role === 'parent') return '/parent/dashboard';
  if (role === 'faculty') return '/faculty-app/dashboard';
  if (role === 'accountant') return '/fees';
  return '/dashboard';
};

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role || '';
  const path = location.pathname;

  if (role === 'parent' && !path.startsWith('/parent')) {
    return <Navigate to={getRoleHome(role)} replace />;
  }

  if (role === 'faculty' && !path.startsWith('/faculty-app')) {
    return <Navigate to={getRoleHome(role)} replace />;
  }

  if (role === 'accountant' && (path === '/' || path === '/dashboard')) {
    return <Navigate to={getRoleHome(role)} replace />;
  }

  return children;
};

export const RoleRoute = ({ roles, children }) => {
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role || '';

  if (!roles.includes(userRole)) {
    if (['parent', 'faculty', 'accountant'].includes(userRole)) {
      return <Navigate to={getRoleHome(userRole)} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};

export const PublicRoute = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (isAuthenticated) {
    return <Navigate to={getRoleHome(user?.role)} replace />;
  }

  return children;
};

export default ProtectedRoute;
