import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../api';
import { useAuth } from './AuthContext';
import { NAV_ITEMS, ROUTE_PERMISSION } from '../config/navConfig';

const NavContext = createContext(null);

export function NavProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [routePermissions, setRoutePermissions] = useState({});
  const [loading, setLoading] = useState(false);

  const refreshNav = useCallback(() => {
    if (!user) {
      setItems([]);
      setRoutePermissions({});
      return;
    }
    setLoading(true);
    api
      .nav()
      .then((data) => {
        setItems(Array.isArray(data?.items) ? data.items : []);
        setRoutePermissions(typeof data?.route_permissions === 'object' ? data.route_permissions : {});
      })
      .catch(() => {
        setItems([]);
        setRoutePermissions({});
      })
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    refreshNav();
  }, [refreshNav]);

  const navItems = items.length > 0 ? items : NAV_ITEMS;
  const permissionMap = Object.keys(routePermissions).length > 0
    ? { ...ROUTE_PERMISSION, ...routePermissions }
    : ROUTE_PERMISSION;

  const value = {
    items: navItems,
    routePermissions: permissionMap,
    loading,
    refreshNav,
  };

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error('useNav must be used within NavProvider');
  return ctx;
}
