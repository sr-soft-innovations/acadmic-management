import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login page title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Welcome back/i);
  expect(titleElement).toBeInTheDocument();
});