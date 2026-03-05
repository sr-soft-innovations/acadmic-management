/**
 * Tests for AuthContext: login, logout, permission checks.
 */
import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock the API module
jest.mock('../api', () => ({
  __esModule: true,
  default: {
    auth: {
      login: jest.fn(),
      logout: jest.fn().mockResolvedValue(undefined),
      getMe: jest.fn(),
      permissions: jest.fn().mockResolvedValue({
        matrix: {
          admin: ['dashboard:read', 'students:read', 'students:write'],
          staff: ['dashboard:read'],
        },
      }),
    },
  },
}));

import api from '../api';

function TestConsumer() {
  const { user, login, logout, hasPermission, hasRole } = useAuth();
  return (
    <div>
      <span data-testid="user">{user ? user.username : 'none'}</span>
      <span data-testid="role">{user ? user.role : 'none'}</span>
      <button type="button" onClick={() => login('admin', 'pass')}>Do Login</button>
      <button type="button" onClick={() => logout()}>Do Logout</button>
      <span data-testid="perm-dashboard">{hasPermission('dashboard:read') ? 'yes' : 'no'}</span>
      <span data-testid="perm-fake">{hasPermission('fake:read') ? 'yes' : 'no'}</span>
      <span data-testid="role-admin">{hasRole('admin') ? 'yes' : 'no'}</span>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    api.auth.logout.mockResolvedValue(undefined);
    api.auth.permissions.mockResolvedValue({
      matrix: {
        admin: ['dashboard:read', 'students:read', 'students:write'],
        staff: ['dashboard:read'],
      },
    });
  });

  it('starts with no user when localStorage is empty', () => {
    renderWithAuth();
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('login updates user and stores in localStorage', async () => {
    api.auth.login.mockResolvedValue({
      user: { id: '1', username: 'admin', role: 'admin', name: 'Admin' },
      session_id: 'sess123',
      expires_in_minutes: 30,
    });

    renderWithAuth();
    await act(async () => {
      fireEvent.click(screen.getByText('Do Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('admin');
      expect(screen.getByTestId('role')).toHaveTextContent('admin');
    });
    expect(localStorage.getItem('college_erp_user')).toBeTruthy();
    expect(localStorage.getItem('college_erp_session_id')).toBe('sess123');
  });

  it('logout clears user and localStorage', async () => {
    api.auth.login.mockResolvedValue({
      user: { id: '1', username: 'admin', role: 'admin', name: 'Admin' },
      session_id: 'sess123',
    });
    renderWithAuth();
    await act(async () => {
      fireEvent.click(screen.getByText('Do Login'));
    });
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('admin'));

    await act(async () => {
      fireEvent.click(screen.getByText('Do Logout'));
    });

    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(localStorage.getItem('college_erp_user')).toBeNull();
    expect(api.auth.logout).toHaveBeenCalledWith('sess123');
  });

  it('hasPermission returns false when no user', () => {
    renderWithAuth();
    expect(screen.getByTestId('perm-dashboard')).toHaveTextContent('no');
  });

  it('hasPermission returns true for permission the role has', async () => {
    api.auth.login.mockResolvedValue({
      user: { id: '1', username: 'admin', role: 'admin', name: 'Admin' },
      session_id: 'sess123',
    });
    renderWithAuth();
    await act(async () => {
      fireEvent.click(screen.getByText('Do Login'));
    });
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('admin'));

    // Permissions are loaded async; admin has dashboard:read
    await waitFor(() => {
      expect(screen.getByTestId('perm-dashboard')).toHaveTextContent('yes');
    });
  });

  it('hasRole returns true for current role', async () => {
    api.auth.login.mockResolvedValue({
      user: { id: '1', username: 'admin', role: 'admin', name: 'Admin' },
      session_id: 'sess123',
    });
    renderWithAuth();
    await act(async () => {
      fireEvent.click(screen.getByText('Do Login'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('role-admin')).toHaveTextContent('yes');
    });
  });
});
