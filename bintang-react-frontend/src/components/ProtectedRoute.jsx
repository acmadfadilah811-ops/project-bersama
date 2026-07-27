import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasMenuAccess, getFeatureIdByPath } from '../utils/permissions';
import BrandyLicenseGate from './BrandyLicenseGate';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [licenseApproved, setLicenseApproved] = useState(false);

  // Reaktif terhadap pergantian user / session
  useEffect(() => {
    if (user) {
      const accepted = localStorage.getItem(`brandy_license_accepted_user_${user.id}`) === 'true';
      setLicenseApproved(accepted);
    } else {
      setLicenseApproved(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <p className="text-slate-400">Memuat...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Jika user aktif belum menyetujui lisensi developer Brandy, tampilkan License Gate
  if (!licenseApproved) {
    return (
      <BrandyLicenseGate
        onApprove={() => {
          localStorage.setItem(`brandy_license_accepted_user_${user.id}`, 'true');
          setLicenseApproved(true);
        }}
      />
    );
  }

  const userRole = user.role?.toLowerCase() || 'staff';
  const fid = getFeatureIdByPath(location.pathname);

  // Cek otorisasi menu — pengecualian untuk halaman profil & dashboard dasar
  const isBasicRoute = location.pathname === '/profile' || location.pathname === '/dashboard' || location.pathname === '/staff-dashboard' || location.pathname === '/';
  if (!isBasicRoute && fid && !hasMenuAccess(userRole, fid)) {
    const redirectPath = userRole === 'staff' ? '/staff-dashboard' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />;
}
