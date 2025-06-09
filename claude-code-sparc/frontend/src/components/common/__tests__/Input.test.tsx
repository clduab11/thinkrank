import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../Input';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />);
    
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders with label', () => {
    render(<Input label="Email Address" name="email" />);
    
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
  });

  it('handles value changes', async () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'test value');
    
    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue('test value');
  });

  it('can be disabled', () => {
    render(<Input disabled placeholder="Disabled input" />);
    
    const input = screen.getByPlaceholderText('Disabled input');
    expect(input).toBeDisabled();
  });

  it('shows error state', () => {
    render(<Input error="This field is required" />);
    
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveClass('border-error');
  });

  it('shows helper text', () => {
    render(<Input helperText="Must be at least 8 characters" />);
    
    expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
  });

  it('renders with different types', () => {
    const { rerender, container } = render(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    
    rerender(<Input type="password" />);
    const passwordInput = container.querySelector('input[type="password"]');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    rerender(<Input type="number" />);
    expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number');
  });

  it('renders with required indicator', () => {
    render(<Input label="Username" required />);
    
    const label = screen.getByText('Username');
    const requiredIndicator = label.parentElement?.querySelector('.text-error');
    expect(requiredIndicator).toHaveTextContent('*');
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<Input ref={ref} />);
    
    expect(ref).toHaveBeenCalled();
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" />);
    
    expect(screen.getByRole('textbox')).toHaveClass('custom-input');
  });

  it('handles focus and blur events', () => {
    const handleFocus = vi.fn();
    const handleBlur = vi.fn();
    
    render(<Input onFocus={handleFocus} onBlur={handleBlur} />);
    
    const input = screen.getByRole('textbox');
    
    fireEvent.focus(input);
    expect(handleFocus).toHaveBeenCalledTimes(1);
    
    fireEvent.blur(input);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('renders with prefix icon', () => {
    render(<Input prefix={<span data-testid="search-icon">🔍</span>} />);
    
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('renders with suffix icon', () => {
    render(<Input suffix={<span data-testid="eye-icon">👁️</span>} />);
    
    expect(screen.getByTestId('eye-icon')).toBeInTheDocument();
  });

  it('handles maxLength constraint', () => {
    render(<Input maxLength={10} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('maxLength', '10');
  });

  it('renders as textarea when multiline', () => {
    render(<Input multiline rows={4} placeholder="Enter message" />);
    
    const textarea = screen.getByPlaceholderText('Enter message');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea).toHaveAttribute('rows', '4');
  });

  it('applies size styles', () => {
    const { rerender } = render(<Input size="small" />);
    expect(screen.getByRole('textbox')).toHaveClass('py-1 px-2 text-sm');
    
    rerender(<Input size="medium" />);
    expect(screen.getByRole('textbox')).toHaveClass('py-2 px-3 text-base');
    
    rerender(<Input size="large" />);
    expect(screen.getByRole('textbox')).toHaveClass('py-3 px-4 text-lg');
  });

  it('handles autoComplete attribute', () => {
    render(<Input autoComplete="email" />);
    
    expect(screen.getByRole('textbox')).toHaveAttribute('autoComplete', 'email');
  });

  it('renders with full width', () => {
    render(<Input fullWidth />);
    
    expect(screen.getByRole('textbox')).toHaveClass('w-full');
  });

  it('handles pattern validation', () => {
    render(<Input pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" />);
    
    expect(screen.getByRole('textbox')).toHaveAttribute('pattern', '[0-9]{3}-[0-9]{3}-[0-9]{4}');
  });
});