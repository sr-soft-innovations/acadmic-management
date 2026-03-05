/**
 * Tests for Placeholder: add, save, export.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Placeholder from './Placeholder';

const STORAGE_PREFIX = 'erp_page_data_';

function renderPlaceholder(props = {}) {
  return render(
    <MemoryRouter>
      <Placeholder title="Test Page" {...props} />
    </MemoryRouter>
  );
}

describe('Placeholder', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders page title and Add button', () => {
    renderPlaceholder({ title: 'Fee Report' });
    expect(screen.getByRole('heading', { name: /fee report/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('shows empty state when no records', () => {
    renderPlaceholder();
    expect(screen.getByText(/no records yet/i)).toBeInTheDocument();
  });

  it('opens modal when Add is clicked', () => {
    renderPlaceholder();
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(screen.getByRole('heading', { name: /new record/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/title or name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
  });

  it('saves new record and shows it in table', () => {
    renderPlaceholder({ title: 'TestPage' });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/title or name/i), { target: { value: 'First Item' } });
    fireEvent.change(screen.getByPlaceholderText(/optional description/i), { target: { value: 'Some description' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.queryByRole('heading', { name: /new record/i })).not.toBeInTheDocument();
    expect(screen.getByText('First Item')).toBeInTheDocument();
    expect(screen.getByText('Some description')).toBeInTheDocument();
  });

  it('shows error when saving without name', () => {
    renderPlaceholder();
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/title or name/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByText(/name is required/i)).toBeInTheDocument();
  });

  it('persists data in localStorage under page key', () => {
    renderPlaceholder({ title: 'My Module' });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    fireEvent.change(screen.getByPlaceholderText(/title or name/i), { target: { value: 'Stored Item' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    const key = `${STORAGE_PREFIX}my_module`;
    const raw = localStorage.getItem(key);
    expect(raw).toBeTruthy();
    const data = JSON.parse(raw);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
    expect(data[0].name).toBe('Stored Item');
  });

  it('Export CSV button is disabled when list is empty', () => {
    renderPlaceholder();
    const exportBtn = screen.getByRole('button', { name: /export csv/i });
    expect(exportBtn).toBeDisabled();
  });

  it('Export CSV button is enabled when list has items', () => {
    // Slug for "Test Page" is "test_page" (space->_, then toLowerCase)
    localStorage.setItem(
      `${STORAGE_PREFIX}test_page`,
      JSON.stringify([{ id: '1', name: 'A', description: 'D', status: 'Active', created: '2025-01-01' }])
    );
    renderPlaceholder({ title: 'Test Page' });
    expect(screen.getByRole('button', { name: /export csv/i })).not.toBeDisabled();
  });
});
